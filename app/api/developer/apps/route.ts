import { getAuthenticatedUser } from "@/lib/backend/auth";
import { errorResponse } from "@/lib/backend/errors";
export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { data: apps, error } = await supabase
      .from("applications")
      .select(
        "id, slug, name, repository_owner, repository_name, status, updated_at",
      )
      .eq("publisher_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const revisions = apps.length
      ? await supabase
          .from("application_revisions")
          .select("application_id, status, version, updated_at")
          .in(
            "application_id",
            apps.map((a) => a.id),
          )
          .order("version", { ascending: false })
      : { data: [], error: null };
    if (revisions.error) throw revisions.error;
    const data = apps
      .map((app) => {
        const revision = revisions.data.find(
          (r) => r.application_id === app.id,
        );
        return {
          id: app.id,
          slug: app.slug,
          name: app.name,
          repository: `${app.repository_owner}/${app.repository_name}`,
          status: app.status,
          revisionStatus: revision?.status ?? null,
          version: revision?.version ?? 0,
          updatedAt: revision?.updated_at ?? app.updated_at,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
