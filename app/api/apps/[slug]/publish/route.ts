import { getAuthenticatedUser, getGithubProviderToken } from "@/lib/backend/auth";
import { ApiError, errorResponse } from "@/lib/backend/errors";
import { verifyGithubRepository } from "@/lib/backend/github";
import { saveVerifiedReleaseData } from "@/lib/backend/release-storage";
import { apiUuidSchema, publicationEligible } from "@/lib/backend/validation";
import { createSupabaseAdminClient } from "@/lib/backend/supabase-admin";
import { classifyAsset } from "@/lib/publishing/assets";
import { isOfficialAssetUrl } from "@/lib/publishing/validation";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { slug: id } = await params;
    if (!apiUuidSchema.safeParse(id).success) throw new ApiError("Invalid application ID.", 400, "INVALID_ID");
    const { supabase, user } = await getAuthenticatedUser();
    const { data: app, error: appError } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
    if (appError) throw appError;
    if (!app || app.publisher_id !== user.id) throw new ApiError("Application not found.", 404, "NOT_FOUND");
    if (app.status !== "draft") throw new ApiError("Only a draft can be submitted for review.", 409, "INVALID_STATUS");
    if (!app.name.trim() || !app.summary.trim() || !app.description.trim()) {
      throw new ApiError("Complete the application name, summary, and description before publishing.", 422, "INCOMPLETE_LISTING");
    }
    const { data: categories, error: categoryError } = await supabase.from("application_categories").select("category_id").eq("application_id", app.id);
    if (categoryError) throw categoryError;
    const token = await getGithubProviderToken(supabase, user);
    const { repository, releases } = await verifyGithubRepository(app.repository_url, token);
    if (repository.id !== app.github_repository_id) throw new ApiError("The repository no longer matches this listing.", 409, "REPOSITORY_CHANGED");
    const license = repository.license?.spdx_id === "NOASSERTION" ? null : repository.license?.spdx_id ?? null;
    if (!license) {
      throw new ApiError("GitHub could not identify an open-source licence for this repository.", 422, "LICENSE_REQUIRED");
    }
    const stableReleases = releases.filter((release) => !release.draft && !release.prerelease);
    const repositoryFullName = `${repository.owner.login}/${repository.name}`;
    const hasSupportedRelease = stableReleases.some((release) => release.assets.some((asset) => {
      const classification = classifyAsset(asset, release.id);
      return classification.eligible
        && isOfficialAssetUrl(asset.browser_download_url, repositoryFullName)
        && ["windows", "macos", "linux"].includes(classification.platform ?? "");
    }));
    if (!publicationEligible({
      webUrl: app.web_url,
      hasCategory: Boolean(categories?.length),
      hasOpenSourceLicense: Boolean(license),
      hasStableRelease: stableReleases.length > 0,
      hasCompatibleAsset: hasSupportedRelease,
    })) {
      throw new ApiError("A stable release with a supported installer, or a web application URL, is required.", 422, "INCOMPLETE_RELEASE");
    }
    const admin = createSupabaseAdminClient();
    const { data: updated, error: updateError } = await admin.from("applications").update({
      status: "pending_review",
      repository_url: repository.html_url,
      repository_owner: repository.owner.login,
      repository_name: repository.name,
      license,
    }).eq("id", app.id).eq("publisher_id", user.id).eq("status", "draft").select("id, slug, status, updated_at").single();
    if (updateError) throw updateError;
    try {
      await saveVerifiedReleaseData(admin, app.id, repositoryFullName, releases, null, [], true);
    } catch (error) {
      const { error: restoreError } = await admin.from("applications").update({ status: "draft" }).eq("id", app.id).eq("status", "pending_review");
      if (restoreError) console.error("Could not restore draft after failed release synchronization.", restoreError);
      throw error;
    }
    return Response.json({
      data: {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        updatedAt: updated.updated_at,
        message: "Listing submitted for review. It is not yet visible in the public marketplace.",
      },
    }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
