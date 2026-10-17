import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import {
  assertAdmin,
  adminApprovalSchema,
  adminErrorResponse,
} from "../lib/backend/admin-access.ts";
import { ApiError, readJson } from "../lib/backend/errors.ts";
import { apiUuidSchema } from "../lib/backend/validation.ts";

import {
  applicationLookupSchema,
  applicationDeletionSchema,
  applicationSlugFromUrl,
  deletionErrorResponse,
} from "../lib/backend/admin-deletion-validation.ts";

const adminId = "10000000-0000-4000-8000-000000000001";
const revisionId = "10000000-0000-4000-8000-000000000002";
// Execute the actual server modules with only their external session/database boundaries replaced.
async function serverModule(path, imports, env = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    output,
    {
      exports,
      process: { env },
      Response,
      Request,
      URL,
      console,
      require(name) {
        if (name === "server-only") return {};
        if (!(name in imports))
          throw new Error(`Unexpected dependency: ${name}`);
        return imports[name];
      },
    },
    { filename: path },
  );
  return exports;
}

test("admin allowlist fails closed and accepts only valid exact UUID entries", () => {
  for (const value of [undefined, "", " , ", "not-a-uuid", `${adminId}x`])
    assert.throws(
      () => assertAdmin(adminId, value),
      (e) => e.status === 403,
    );
  assert.doesNotThrow(() => assertAdmin(adminId, ` , invalid, ${adminId} ,`));
  assert.equal(
    adminApprovalSchema.safeParse({ expectedVersion: 0 }).success,
    false,
  );
  assert.equal(
    adminApprovalSchema.safeParse({ expectedVersion: 1, reviewedBy: adminId })
      .success,
    false,
  );
  assert.equal(
    adminApprovalSchema.safeParse({ expectedVersion: 1, snapshot: {} }).success,
    false,
  );
});

test("all admin handlers authorize before privileged database access, including invalid requests", async () => {
  for (const identity of [null, { id: revisionId }, { id: adminId }]) {
    let clients = 0;
    const calls = [];
    const client = {
      from() {
        calls.push("query");
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          then(resolve) {
            resolve({ data: [], error: null });
          },
        };
      },
      async rpc(name, args) {
        calls.push({ name, args });
        return {
          data: [{ id: revisionId, slug: "tool", status: "published" }],
          error: null,
        };
      },
    };
    const services = await serverModule(
      "lib/backend/admin.ts",
      {
        "./auth": {
          async getAuthenticatedUser() {
            if (!identity)
              throw new ApiError("Sign in required.", 401, "UNAUTHENTICATED");
            return { user: identity };
          },
        },
        "./admin-access": { assertAdmin },
        "./supabase-admin": {
          createSupabaseAdminClient() {
            clients++;
            return client;
          },
        },
        "./errors": { ApiError },
      },
      { ADMIN_USER_IDS: adminId },
    );
    const deps = {
      "@/lib/backend/admin": services,
      "@/lib/backend/admin-access": { adminApprovalSchema, adminErrorResponse },
      "@/lib/backend/validation": { apiUuidSchema },
      "@/lib/backend/errors": { ApiError, readJson },
    };
    const queue = await serverModule("app/api/admin/revisions/route.ts", deps);
    const detail = await serverModule(
      "app/api/admin/revisions/[id]/route.ts",
      deps,
    );
    const approve = await serverModule(
      "app/api/admin/revisions/[id]/approve/route.ts",
      deps,
    );
    const expected = !identity ? 401 : identity.id === adminId ? 200 : 403;
    const response = await queue.GET();
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    for (const handler of [detail.GET, approve.POST]) {
      const result = await handler(
        new Request("https://commons.test/api", {
          method: "POST",
          body: "invalid",
        }),
        { params: Promise.resolve({ id: "bad" }) },
      );
      assert.equal(result.status, expected === 200 ? 404 : expected);
      assert.equal(result.headers.get("Cache-Control"), "no-store");
    }
    const approval = await approve.POST(
      new Request("https://commons.test/api", {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 7 }),
      }),
      { params: Promise.resolve({ id: revisionId }) },
    );
    assert.equal(approval.status, expected);
    if (expected === 200) {
      assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), {
        name: "admin_approve_application_revision",
        args: {
          p_revision_id: revisionId,
          p_expected_version: 7,
          p_admin_user_id: adminId,
        },
      });
      const invalid = await approve.POST(
        new Request("https://commons.test/api", {
          method: "POST",
          body: JSON.stringify({ expectedVersion: 7, reviewedBy: revisionId }),
        }),
        { params: Promise.resolve({ id: revisionId }) },
      );
      assert.equal(invalid.status, 422);
    } else assert.equal(clients, 0);
  }
});

test("admin errors distinguish stale review and unavailable schema, all without caching", async () => {
  for (const [code, status, apiCode] of [
    ["40001", 409, "STALE_SUBMISSION"],
    ["55000", 409, "STALE_SUBMISSION"],
    ["P0002", 404, "NOT_FOUND"],
    ["PGRST202", 503, "MIGRATION_REQUIRED"],
    ["PGRST205", 503, "MIGRATION_REQUIRED"],
  ]) {
    const response = adminErrorResponse({ code });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).error.code, apiCode);
  }
});

test("admin reads expose submitted names and context without leaking snapshots into queue summaries", async () => {
  const revision = {
    id: revisionId,
    application_id: revisionId,
    version: 8,
    status: "pending_review",
    updated_at: "2026-10-17T00:00:00Z",
    snapshot: {
      input: { name: "Submitted new name" },
      repository: { fullName: "owner/tool" },
      categoryId: revisionId,
    },
  };
  const records = {
    application_revisions: revision,
    applications: {
      id: revisionId,
      slug: "original-slug",
      status: "published",
      published_at: "2026-10-16T00:00:00Z",
      publisher_id: adminId,
    },
    developer_profiles: {
      user_id: adminId,
      github_username: "owner",
      display_name: "Publisher",
    },
  };
  const services = await serverModule(
    "lib/backend/admin.ts",
    {
      "./auth": {
        async getAuthenticatedUser() {
          return { user: { id: adminId } };
        },
      },
      "./admin-access": { assertAdmin },
      "./errors": { ApiError },
      "./supabase-admin": {
        createSupabaseAdminClient() {
          return {
            from(table) {
              return {
                select() {
                  return this;
                },
                eq() {
                  return this;
                },
                order() {
                  return this;
                },
                async single() {
                  return { data: records[table], error: null };
                },
                async maybeSingle() {
                  return { data: records[table], error: null };
                },
                then(resolve) {
                  resolve({ data: [records[table]], error: null });
                },
              };
            },
          };
        },
      },
    },
    { ADMIN_USER_IDS: adminId },
  );
  const queue = await services.pendingAdminRevisions();
  assert.equal(queue[0].name, "Submitted new name");
  assert.equal(queue[0].isUpdate, true);
  assert.equal(queue[0].application.slug, "original-slug");
  assert.equal("snapshot" in queue[0], false);
  assert.equal(
    (await services.adminRevision(revisionId)).snapshot,
    revision.snapshot,
  );
});

test("application URL and deletion inputs reject alternate targets and privileged fields", () => {
  const origin = "http://localhost:3000";
  assert.equal(
    applicationSlugFromUrl(origin + "/apps/skyblockhack", origin),
    "skyblockhack",
  );
  assert.equal(
    applicationSlugFromUrl(origin + "/apps/skyblockhack/", origin),
    "skyblockhack",
  );
  for (const url of [
    "https://other.test/apps/skyblockhack",
    origin + "/apps",
    origin + "/apps/skyblockhack/other",
    origin + "/apps/skyblockhack?platform=windows",
    origin + "/apps/skyblockhack#details",
    origin + "/apps/%73kyblockhack",
    "http://user:password@localhost:3000/apps/skyblockhack",
  ]) {
    assert.throws(
      () => applicationSlugFromUrl(url, origin),
      (e) => e.status === 422,
    );
  }
  assert.equal(
    applicationLookupSchema.safeParse({
      url: origin + "/apps/skyblockhack",
      id: revisionId,
    }).success,
    false,
  );
  const input = {
    confirmSlug: "skyblockhack",
    expectedUpdatedAt: "2026-10-18T00:00:00.123456+00:00",
  };
  assert.equal(applicationDeletionSchema.safeParse(input).success, true);
  assert.equal(
    applicationDeletionSchema.safeParse({
      ...input,
      expectedUpdatedAt: "yesterday",
    }).success,
    false,
  );
  assert.equal(
    applicationDeletionSchema.safeParse({ ...input, adminId }).success,
    false,
  );
});

test("deletion APIs authorize before lookup or mutation, validate previews, and confirm database results", async () => {
  for (const identity of [null, { id: revisionId }, { id: adminId }]) {
    let clients = 0;
    let rpcError = null;
    const calls = [];
    const app = {
      id: revisionId,
      slug: "skyblockhack",
      name: "Test application",
      status: "published",
      repository_url: "https://github.com/owner/test",
      publisher_id: adminId,
      updated_at: "2026-10-18T00:00:00.123456+00:00",
    };
    const requireAdmin = async () => {
      if (!identity)
        throw new ApiError("Sign in required.", 401, "UNAUTHENTICATED");
      assertAdmin(identity.id, adminId);
      return identity;
    };
    const services = await serverModule("lib/backend/admin-deletion.ts", {
      "./admin": { requireAdmin },
      "./admin-deletion-validation": { applicationSlugFromUrl },
      "./errors": { ApiError },
      "./supabase-admin": {
        createSupabaseAdminClient() {
          clients++;
          return {
            from(table) {
              return {
                select() {
                  return this;
                },
                eq() {
                  return this;
                },
                async maybeSingle() {
                  return {
                    data:
                      table === "applications"
                        ? app
                        : { github_username: "owner", display_name: "Owner" },
                    error: null,
                  };
                },
              };
            },
            async rpc(name, args) {
              calls.push({ name, args });
              return {
                data: [{ id: revisionId, slug: "skyblockhack" }],
                error: rpcError,
              };
            },
          };
        },
      },
    });
    const paths = [];
    const deps = {
      "@/lib/backend/admin": { requireAdmin },
      "@/lib/backend/admin-deletion": services,
      "@/lib/backend/admin-deletion-validation": {
        applicationLookupSchema,
        applicationDeletionSchema,
        deletionErrorResponse,
      },
      "@/lib/backend/validation": { apiUuidSchema },
      "@/lib/backend/errors": { ApiError, readJson, logServerError() {} },
      "next/cache": {
        revalidatePath(path) {
          paths.push(path);
        },
      },
    };
    const lookup = await serverModule(
      "app/api/admin/applications/lookup/route.ts",
      deps,
    );
    const remove = await serverModule(
      "app/api/admin/applications/[id]/route.ts",
      deps,
    );
    const expected = !identity ? 401 : identity.id === adminId ? 200 : 403;
    const response = await lookup.POST(
      new Request("http://localhost:3000/api/admin/applications/lookup", {
        method: "POST",
        body: JSON.stringify({
          url: "http://localhost:3000/apps/skyblockhack",
        }),
      }),
    );
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    if (expected === 200) {
      const result = (await response.json()).data;
      assert.equal(result.updatedAt, app.updated_at);
      assert.equal(result.slug, "skyblockhack");
      assert.equal(result.publisher.githubUsername, "owner");
    }
    const input = {
      confirmSlug: "skyblockhack",
      expectedUpdatedAt: app.updated_at,
    };
    const invoke = (body = input, id = revisionId) =>
      remove.DELETE(
        new Request("http://localhost:3000/api/admin/applications/" + id, {
          method: "DELETE",
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) },
      );
    const deleted = await invoke();
    assert.equal(deleted.status, expected);
    assert.equal(deleted.headers.get("Cache-Control"), "no-store");
    if (expected === 200) {
      assert.equal((await deleted.json()).data.deleted, true);
      assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
        name: "admin_delete_application",
        args: {
          p_application_id: revisionId,
          p_confirm_slug: input.confirmSlug,
          p_expected_updated_at: app.updated_at,
        },
      });
      assert.ok(paths.includes("/apps/skyblockhack"));
      assert.equal((await invoke({ confirmSlug: "skyblockhack" })).status, 422);
      assert.equal((await invoke(input, "invalid")).status, 404);
      rpcError = { code: "40001" };
      const stale = await invoke();
      assert.equal(stale.status, 409);
      assert.equal((await stale.json()).error.code, "STALE_APPLICATION");
      rpcError = { code: "PGRST202" };
      assert.equal((await invoke()).status, 503);
    } else {
      assert.equal(clients, 0);
      assert.equal((await invoke({}, "invalid")).status, expected);
    }
  }
});
