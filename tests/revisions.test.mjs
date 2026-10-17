import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
test("Postgres revision lifecycle, approval transactions, and owner isolation", async (t) => {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
    alter default privileges in schema public grant select on tables to anon;
  `);
  for (const name of [
    "202610170001_commons_marketplace.sql",
    "202610170002_publisher_revisions.sql",
    "202610170003_admin_review.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  await db.query("insert into auth.users values ($1),($2)", [owner, other]);
  await db.query(
    "insert into developer_profiles(user_id,github_username) values($1,'owner'),($2,'other')",
    [owner, other],
  );
  const category = (
    await db.query("select id from categories where slug='utilities'")
  ).rows[0].id;
  const snapshot = {
    categoryId: category,
    input: {
      repository: "owner/tool",
      name: "Tool",
      summary: "A useful tool",
      description: "A useful application.",
      category: "Utilities",
      screenshots: ["https://example.test/screen.png"],
      iconUrl: "",
      websiteUrl: "",
      webUrl: "",
      releaseId: 21,
      assets: [{ id: 31, platform: "windows", architecture: "x64" }],
    },
    repository: {
      id: 11,
      fullName: "owner/tool",
      name: "tool",
      url: "https://github.com/owner/tool",
      owner: "owner",
      license: "MIT",
      releases: [
        {
          id: 21,
          version: "v1",
          notes: "First release",
          publishedAt: "2026-10-17T00:00:00Z",
          url: "https://github.com/owner/tool/releases/tag/v1",
          assets: [
            {
              id: 31,
              name: "tool-x64.exe",
              url: "https://github.com/owner/tool/releases/download/v1/tool-x64.exe",
              platform: "windows",
              architecture: "x64",
              eligible: true,
              size: 1000,
            },
            {
              id: 32,
              name: "tool-arm64.exe",
              url: "https://github.com/owner/tool/releases/download/v1/tool-arm64.exe",
              platform: "windows",
              architecture: "arm64",
              eligible: true,
              size: 1000,
            },
          ],
        },
      ],
    },
  };
  const save = async (id, version, value = snapshot, user = owner) =>
    (
      await db.query("select publisher_save_draft($1,$2,$3,$4) as id", [
        user,
        id,
        version,
        JSON.stringify(value),
      ])
    ).rows[0].id;
  const latest = async (id) =>
    (
      await db.query(
        "select * from application_revisions where application_id=$1 order by version desc limit 1",
        [id],
      )
    ).rows[0];
  const app = async (id) =>
    (await db.query("select * from applications where id=$1", [id])).rows[0];
  const submit = (id, version, value = snapshot) =>
    db.query("select publisher_submit_revision($1,$2,$3,$4)", [
      owner,
      id,
      version,
      JSON.stringify(value),
    ]);
  let id;
  await t.test(
    "creates one persistent draft and rejects duplicate repositories",
    async () => {
      id = await save(null, 0);
      assert.equal((await latest(id)).version, 1);
      assert.equal((await app(id)).status, "draft");
      await assert.rejects(save(null, 0), (e) => e.code === "23505");
      assert.equal(
        (await db.query("select count(*) from applications")).rows[0].count,
        1,
      );
    },
  );
  await t.test(
    "private drafts are not readable by other users or anonymous visitors",
    async () => {
      await db.exec("set role anon;");
      assert.equal(
        (await db.query("select * from applications")).rows.length,
        0,
      );
      await db.exec(
        `reset role; set role authenticated; set request.jwt.claim.sub='${other}';`,
      );
      assert.equal(
        (await db.query("select * from applications")).rows.length,
        0,
      );
      await db.exec("reset role;");
    },
  );
  await t.test(
    "long names generate valid slugs at the truncation boundary",
    async () => {
      const long = structuredClone(snapshot);
      long.input.name = "a".repeat(64) + "-" + "b".repeat(14);
      long.input.repository = "owner/long";
      long.input.releaseId = null;
      long.input.assets = [];
      long.input.webUrl = "https://example.test";
      long.repository = {
        ...long.repository,
        id: 12,
        fullName: "owner/long",
        url: "https://github.com/owner/long",
        releases: [],
      };
      const created = await save(null, 0, long);
      assert.match((await app(created)).slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    },
  );
  await t.test(
    "rejects stale saves and wrong owners without modifying the snapshot",
    async () => {
      await assert.rejects(save(id, 0), (e) => e.code === "40001");
      await assert.rejects(
        save(id, 1, snapshot, other),
        (e) => e.code === "P0002",
      );
      assert.equal((await latest(id)).version, 1);
    },
  );
  await t.test(
    "submission locks the exact selected installers until explicitly reopened",
    async () => {
      await submit(id, 1);
      assert.equal((await app(id)).status, "pending_review");
      assert.equal((await latest(id)).status, "pending_review");
      await assert.rejects(save(id, 2), (e) => e.code === "55000");
      await db.query("select publisher_reopen_revision($1,$2,$3)", [
        owner,
        id,
        2,
      ]);
      assert.equal((await app(id)).status, "draft");
      assert.equal((await latest(id)).version, 3);
      await assert.rejects(
        db.query("select * from admin_approve_application_revision($1,$2,$3)", [
          (await latest(id)).id,
          2,
          other,
        ]),
        (e) => e.code === "40001",
      );
      await submit(id, 3);
      await assert.rejects(
        db.query("select * from admin_approve_application_revision($1,$2,$3)", [
          (await latest(id)).id,
          2,
          other,
        ]),
        (e) => e.code === "40001",
      );
    },
  );
  await t.test(
    "approval exposes only the selected release asset and all listing fields",
    async () => {
      const revision = await latest(id);
      const result = await db.query(
        "select * from admin_approve_application_revision($1,$2,$3)",
        [revision.id, revision.version, other],
      );
      assert.equal(result.rows[0].id, id);
      assert.equal(result.rows[0].status, "published");
      assert.equal((await latest(id)).reviewed_by, other);
      assert.ok((await latest(id)).reviewed_at);
      await assert.rejects(
        db.query("select * from admin_approve_application_revision($1,$2,$3)", [
          revision.id,
          revision.version,
          other,
        ]),
        (e) => e.code === "40001",
      );
      const current = await app(id);
      assert.equal(current.status, "published");
      assert.equal(current.name, "Tool");
      assert.equal(current.distribution_selection.assets.length, 1);
      const assets = (
        await db.query("select github_asset_id from release_assets")
      ).rows;
      assert.deepEqual(
        assets.map((a) => a.github_asset_id),
        [31],
      );
      assert.equal(
        (await db.query("select image_url from application_screenshots"))
          .rows[0].image_url,
        "https://example.test/screen.png",
      );
    },
  );
  let update;
  await t.test(
    "preparing and submitting an update leaves the public version untouched",
    async () => {
      update = structuredClone(snapshot);
      update.input.name = "Tool 2";
      update.input.assets = [
        { id: 32, platform: "windows", architecture: "arm64" },
      ];
      await save(id, 4, update);
      await submit(id, 5, update);
      assert.equal((await app(id)).name, "Tool");
      assert.equal((await app(id)).status, "published");
      assert.equal((await latest(id)).status, "pending_review");
      assert.deepEqual(
        (await db.query("select github_asset_id from release_assets")).rows.map(
          (a) => a.github_asset_id,
        ),
        [31],
      );
    },
  );
  await t.test(
    "failed approval rolls back child replacement and the public listing",
    async () => {
      const revision = await latest(id),
        broken = structuredClone(update);
      broken.input.screenshots = ["http://unsafe.test/image.png"];
      await db.query(
        "update application_revisions set snapshot=$1 where id=$2",
        [JSON.stringify(broken), revision.id],
      );
      await assert.rejects(
        db.query("select approve_application_revision($1)", [revision.id]),
      );
      assert.equal((await app(id)).name, "Tool");
      assert.deepEqual(
        (await db.query("select github_asset_id from release_assets")).rows.map(
          (a) => a.github_asset_id,
        ),
        [31],
      );
      assert.equal((await latest(id)).status, "pending_review");
      await db.query(
        "update application_revisions set snapshot=$1 where id=$2",
        [JSON.stringify(update), revision.id],
      );
    },
  );
  await t.test(
    "attribution failure rolls back publication and reviewer fields together",
    async () => {
      const revision = await latest(id);
      await assert.rejects(
        db.query("select * from admin_approve_application_revision($1,$2,$3)", [
          revision.id,
          revision.version,
          "10000000-0000-4000-8000-000000000099",
        ]),
        (e) => e.code === "23503",
      );
      assert.equal((await app(id)).name, "Tool");
      assert.equal((await latest(id)).status, "pending_review");
      assert.equal((await latest(id)).reviewed_by, null);
      assert.equal((await latest(id)).reviewed_at, null);
      assert.deepEqual(
        (await db.query("select github_asset_id from release_assets")).rows.map(
          (a) => a.github_asset_id,
        ),
        [31],
      );
    },
  );
  await t.test(
    "wrapper is unavailable to anonymous and ordinary authenticated users",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        try {
          await assert.rejects(
            db.query(
              "select * from admin_approve_application_revision($1,$2,$3)",
              ["10000000-0000-4000-8000-000000000099", 6, other],
            ),
            (e) => e.code === "42501",
          );
        } finally {
          await db.exec("reset role");
        }
      }
    },
  );
  await t.test(
    "approved update replaces the public snapshot and preserves its slug",
    async () => {
      const slug = (await app(id)).slug;
      const revision = await latest(id);
      const result = await db.query(
        "select * from admin_approve_application_revision($1,$2,$3)",
        [revision.id, revision.version, other],
      );
      assert.equal(result.rows[0].id, id);
      assert.equal(result.rows[0].status, "published");
      assert.equal((await latest(id)).reviewed_by, other);
      assert.ok((await latest(id)).reviewed_at);
      await assert.rejects(
        db.query("select * from admin_approve_application_revision($1,$2,$3)", [
          revision.id,
          revision.version,
          other,
        ]),
        (e) => e.code === "40001",
      );
      assert.equal((await app(id)).name, "Tool 2");
      assert.equal((await app(id)).slug, slug);
      assert.deepEqual(
        (await db.query("select github_asset_id from release_assets")).rows.map(
          (a) => a.github_asset_id,
        ),
        [32],
      );
    },
  );
  await t.test(
    "RLS hides revisions from other publishers and anonymous readers",
    async () => {
      await db.exec(
        `set role authenticated; set request.jwt.claim.sub='${other}';`,
      );
      assert.equal(
        (await db.query("select * from application_revisions")).rows.length,
        0,
      );
      await db.exec(`set request.jwt.claim.sub='${owner}';`);
      assert.ok(
        (await db.query("select * from application_revisions")).rows.length > 0,
      );
      await assert.rejects(
        db.query("update application_revisions set status='approved'"),
        (e) => e.code === "42501",
      );
      await assert.rejects(
        db.query("select approve_application_revision($1)", [
          (await latest(id)).id,
        ]),
        (e) => e.code === "42501",
      );
      await db.exec("reset role; set role anon;");
      await assert.rejects(
        db.query("select * from application_revisions"),
        (e) => e.code === "42501",
      );
      await db.exec("reset role;");
    },
  );
});
