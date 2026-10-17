import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetKind, Database, ReleasePlatform } from "@/src/types/database.types";
import { classifyAsset } from "@/lib/publishing/assets";
import { isOfficialAssetUrl, isOfficialReleaseUrl } from "@/lib/publishing/validation";
import { ApiError } from "./errors";
import type { GithubRelease } from "./github";

export async function saveVerifiedReleaseData(
  supabase: SupabaseClient<Database>,
  applicationId: string,
  repositoryFullName: string,
  releases: GithubRelease[],
  chosenReleaseId: number | null = null,
  chosenAssets: Array<{ id: number; platform: "windows" | "macos" | "linux" | "web"; architecture: string }> = [],
  replaceExisting = false,
) {
  const stableReleases = releases.filter((release) => !release.draft && !release.prerelease);
  if (chosenReleaseId !== null && !stableReleases.some((release) => release.id === chosenReleaseId)) {
    throw new ApiError("Choose a stable release from the verified repository.", 422, "INVALID_RELEASE");
  }
  if (chosenAssets.length && chosenReleaseId === null) {
    throw new ApiError("Select a stable release before choosing installer assets.", 422, "INVALID_RELEASE");
  }
  const selectedRelease = stableReleases.find((release) => release.id === chosenReleaseId);
  for (const selected of chosenAssets) {
    const raw = selectedRelease?.assets.find((asset) => asset.id === selected.id);
    if (!raw) throw new ApiError("A selected installer does not belong to the selected release.", 422, "INVALID_ASSET");
    const classified = classifyAsset(raw, selectedRelease!.id);
    if (
      !classified.eligible
      || classified.platform !== selected.platform
      || classified.architecture !== selected.architecture
      || !isOfficialAssetUrl(raw.browser_download_url, repositoryFullName)
    ) {
      throw new ApiError("A selected installer is unsupported or does not match its verified compatibility.", 422, "INVALID_ASSET");
    }
  }
  if (replaceExisting) {
    const { error } = await supabase.from("application_versions").delete().eq("application_id", applicationId);
    if (error) throw error;
  }
  for (const release of stableReleases) {
    if (!isOfficialReleaseUrl(release.html_url, repositoryFullName)) {
      throw new ApiError("GitHub returned an unsupported release URL.", 502, "INVALID_GITHUB_RELEASE");
    }
    const { data: version, error: versionError } = await supabase.from("application_versions").upsert({
      application_id: applicationId,
      github_release_id: release.id,
      version: release.tag_name,
      git_tag: release.tag_name,
      release_name: release.name,
      release_notes: (release.body ?? "").slice(0, 20000),
      github_release_url: release.html_url,
      released_at: release.published_at,
      prerelease: false,
    }, { onConflict: "application_id,github_release_id" }).select("id").single();
    if (versionError) throw versionError;
    const assets = release.assets.filter((asset) => isOfficialAssetUrl(asset.browser_download_url, repositoryFullName));
    if (!assets.length) continue;
    const rows = assets.map((asset) => {
      const classification = classifyAsset(asset, release.id);
      const platform: ReleasePlatform = classification.platform ?? "unknown";
      const kind: AssetKind = classification.eligible
        ? "installer"
        : /source|\.zip$|\.tar\.gz$|\.tgz$/i.test(asset.name) ? "source" : "other";
      return {
        version_id: version.id,
        github_asset_id: asset.id,
        file_name: asset.name,
        download_url: asset.browser_download_url,
        mime_type: asset.content_type,
        file_size_bytes: asset.size,
        platform,
        architecture: classification.architecture,
        kind,
      };
    });
    const { error: assetError } = await supabase.from("release_assets").upsert(rows, { onConflict: "version_id,github_asset_id" });
    if (assetError) throw assetError;
  }
}
