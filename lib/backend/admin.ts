import "server-only";
import { getAuthenticatedUser } from "./auth";
import { assertAdmin } from "./admin-access";
import { createSupabaseAdminClient } from "./supabase-admin";
import { ApiError } from "./errors";
import type {
  AdminRevisionDetail,
  AdminRevisionSummary,
  PublisherSnapshot,
} from "@/src/types/api";
import type { Database } from "@/src/types/database.types";

export async function requireAdmin() {
  const auth = await getAuthenticatedUser();
  assertAdmin(auth.user.id, process.env.ADMIN_USER_IDS);
  return auth.user;
}

type Revision = Database["public"]["Tables"]["application_revisions"]["Row"];
async function revisionContext(
  client: ReturnType<typeof createSupabaseAdminClient>,
  revision: Revision,
): Promise<AdminRevisionDetail> {
  const { data: app, error } = await client
    .from("applications")
    .select("id, slug, status, published_at, publisher_id")
    .eq("id", revision.application_id)
    .single();
  if (error) throw error;
  const { data: publisher, error: profileError } = app.publisher_id
    ? await client
        .from("developer_profiles")
        .select("user_id, github_username, display_name")
        .eq("user_id", app.publisher_id)
        .single()
    : { data: null, error: null };
  if (profileError) throw profileError;
  const snapshot = revision.snapshot as unknown as PublisherSnapshot;
  return {
    id: revision.id,
    version: revision.version,
    status: revision.status,
    name: snapshot.input.name,
    repository: snapshot.repository.fullName,
    submittedAt: revision.updated_at,
    application: { id: app.id, slug: app.slug, status: app.status },
    publisher: {
      id: publisher?.user_id ?? null,
      githubUsername: publisher?.github_username ?? "",
      displayName:
        publisher?.display_name ||
        publisher?.github_username ||
        "Deleted publisher",
    },
    isUpdate: app.published_at !== null,
    snapshot,
  };
}

export async function pendingAdminRevisions(): Promise<AdminRevisionSummary[]> {
  await requireAdmin();
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("application_revisions")
    .select("*")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true })
    .order("id");
  if (error) throw error;
  return Promise.all(
    data.map(async (revision) => {
      const { snapshot: _snapshot, ...summary } = await revisionContext(
        client,
        revision,
      );
      void _snapshot;
      return summary;
    }),
  );
}

export async function adminRevision(id: string) {
  await requireAdmin();
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("application_revisions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("Submission not found.", 404, "NOT_FOUND");
  return revisionContext(client, data);
}

export async function approveAdminRevision(
  id: string,
  expectedVersion: number,
) {
  const user = await requireAdmin();
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc(
    "admin_approve_application_revision",
    {
      p_revision_id: id,
      p_expected_version: expectedVersion,
      p_admin_user_id: user.id,
    },
  );
  if (error) throw error;
  return data[0];
}
