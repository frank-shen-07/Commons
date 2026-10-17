import { ApiError } from "./errors.ts";
import { classifyAsset } from "../publishing/assets.ts";
import {
  isOfficialAssetUrl,
  isOfficialReleaseUrl,
} from "../publishing/validation.ts";
import type { RepositoryImport } from "../publishing/types";
import type { PublishingRequest } from "../../src/types/api";
import type { GithubRepository, GithubRelease } from "./github";

/** Only server-fetched data enters a review snapshot. Browser metadata is never authoritative. */
export function verifiedRepository(
  repository: GithubRepository,
  releases: GithubRelease[],
  readme = "",
): RepositoryImport {
  const fullName = `${repository.owner.login}/${repository.name}`;
  return {
    id: repository.id,
    fullName,
    name: repository.name,
    description: repository.description ?? "",
    url: repository.html_url,
    websiteUrl: repository.homepage ?? "",
    owner: repository.owner.login,
    avatarUrl: repository.owner.avatar_url,
    license:
      repository.license?.spdx_id === "NOASSERTION"
        ? null
        : (repository.license?.spdx_id ?? null),
    readme,
    releases: releases
      .filter(
        (r) =>
          !r.draft &&
          !r.prerelease &&
          isOfficialReleaseUrl(r.html_url, fullName),
      )
      .map((r) => ({
        id: r.id,
        version: r.tag_name,
        publishedAt: r.published_at,
        notes: (r.body ?? "").slice(0, 20000),
        url: r.html_url,
        assets: r.assets
          .filter((a) => isOfficialAssetUrl(a.browser_download_url, fullName))
          .map((a) => classifyAsset(a, r.id)),
      })),
  };
}

export function validateSelection(
  input: PublishingRequest,
  repository: RepositoryImport,
  submitting = false,
) {
  const release = repository.releases.find((r) => r.id === input.releaseId);
  if (input.releaseId != null && !release)
    throw new ApiError(
      "Your selected release is no longer available. Refresh releases and choose again.",
      422,
      "INVALID_RELEASE",
    );
  const seen = new Set<number>();
  for (const choice of input.assets ?? []) {
    const asset = release?.assets.find((a) => a.id === choice.id);
    if (
      seen.has(choice.id) ||
      !asset?.eligible ||
      asset.platform !== choice.platform ||
      asset.architecture !== choice.architecture
    ) {
      throw new ApiError(
        "A selected installer is unavailable or its compatibility has changed. Refresh and choose again.",
        422,
        "INVALID_ASSET",
      );
    }
    seen.add(choice.id);
  }
  if (submitting && !repository.license)
    throw new ApiError(
      "GitHub must identify an open-source licence before you submit.",
      422,
      "LICENSE_REQUIRED",
    );
  if (submitting && !input.webUrl && !seen.size)
    throw new ApiError(
      "Select an installer or provide an HTTPS web app URL before submitting.",
      422,
      "INCOMPLETE_RELEASE",
    );
}
