import "server-only";
import { requireAdmin } from "./admin";
import { createSupabaseAdminClient } from "./supabase-admin";
import { ApiError } from "./errors";
import { applicationSlugFromUrl } from "./admin-deletion-validation";
import type {
  AdminApplicationLookup,
  AdminApplicationDeletionRequest,
  AdminApplicationDeletionResult,
} from "@/src/types/api";

export async function lookupAdminApplication(
  url: string,
  origin: string,
): Promise<AdminApplicationLookup> {
  await requireAdmin();
  const slug = applicationSlugFromUrl(url, origin);
  const client = createSupabaseAdminClient();
  const { data: app, error } = await client
    .from("applications")
    .select("id, slug, name, status, repository_url, publisher_id, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!app)
    throw new ApiError(
      "No stored application matches this URL. Sample-only listings cannot be deleted here.",
      404,
      "NOT_FOUND",
    );
  const { data: publisher, error: profileError } = app.publisher_id
    ? await client
        .from("developer_profiles")
        .select("github_username, display_name")
        .eq("user_id", app.publisher_id)
        .maybeSingle()
    : { data: null, error: null };
  if (profileError) throw profileError;
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    status: app.status,
    repositoryUrl: app.repository_url,
    publisher: {
      githubUsername: publisher?.github_username ?? "",
      displayName:
        publisher?.display_name ||
        publisher?.github_username ||
        "Deleted publisher",
    },
    updatedAt: app.updated_at,
  };
}

export async function deleteAdminApplication(
  id: string,
  input: AdminApplicationDeletionRequest,
): Promise<AdminApplicationDeletionResult> {
  await requireAdmin();
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("admin_delete_application", {
    p_application_id: id,
    p_confirm_slug: input.confirmSlug,
    p_expected_updated_at: input.expectedUpdatedAt,
  });
  if (error) throw error;
  if (!data?.[0])
    throw new ApiError(
      "The database did not confirm deletion. Find the application again to check its status.",
      500,
      "DELETION_UNCONFIRMED",
    );
  return { ...data[0], deleted: true };
}
