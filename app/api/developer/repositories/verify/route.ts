import { getAuthenticatedUser, getGithubProviderToken } from "@/lib/backend/auth";
import { errorResponse } from "@/lib/backend/errors";
import { verifyGithubRepository } from "@/lib/backend/github";
import { classifyAsset } from "@/lib/publishing/assets";

export async function GET(request: Request) {
  try {
    const repository = new URL(request.url).searchParams.get("repository") ?? "";
    const { supabase, user } = await getAuthenticatedUser();
    const token = await getGithubProviderToken(supabase, user);
    const result = await verifyGithubRepository(repository, token);
    return Response.json({
      data: {
        repository: {
          id: result.repository.id,
          fullName: result.repository.full_name,
          name: result.repository.name,
          description: result.repository.description ?? "",
          url: result.repository.html_url,
          owner: result.repository.owner.login,
          license: result.repository.license?.spdx_id ?? null,
        },
        releases: result.releases.filter((release) => !release.draft && !release.prerelease).map((release) => ({
          id: release.id,
          version: release.tag_name,
          name: release.name,
          notes: (release.body ?? "").slice(0, 20000),
          url: release.html_url,
          publishedAt: release.published_at,
          assets: release.assets.map((asset) => classifyAsset(asset, release.id)),
        })),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
