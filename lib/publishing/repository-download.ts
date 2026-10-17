import {
  installationInstructions,
} from "./assets.ts";
import { isOfficialAssetUrl } from "./validation.ts";
import type {
  ImportedRelease,
  ReleaseAsset,
} from "./types";
import type { Platform } from "../types";

type RepositoryDownloadOption = {
  platform: Platform;
  url: string;
  label: string;
  architecture: ReleaseAsset["architecture"];
  format: string;
  instructions: string;
};

export type RepositoryDownloadResolution =
  | { kind: "available"; option: RepositoryDownloadOption }
  | {
      kind: "choices";
      choices: {
        assetId: string;
        fileName: string;
        architecture: ReleaseAsset["architecture"];
        sizeBytes: number;
        format: string;
      }[];
    }
  | { kind: "unavailable"; message: string };

export function resolveRepositoryDownload(
  releases: ImportedRelease[],
  repository: string,
  platform: Exclude<Platform, "web">,
  assetId: string | null,
): RepositoryDownloadResolution {
  const latestRelease = releases.find((release) =>
    release.assets.some((asset) => isDownloadable(asset, repository, platform)),
  );
  if (!latestRelease) {
    return {
      kind: "unavailable",
      message:
        "No supported installer was found for this device. Check the official releases.",
    };
  }

  const assets = latestRelease.assets.filter((asset) =>
    isDownloadable(asset, repository, platform),
  );
  if (assetId) {
    const asset = assets.find((candidate) => String(candidate.id) === assetId);
    if (!asset) {
      return {
        kind: "unavailable",
        message:
          "That installer is no longer available. Refresh the repository preview.",
      };
    }
    return {
      kind: "available",
      option: downloadOption(asset, platform),
    };
  }

  if (assets.length > 1) {
    return {
      kind: "choices",
      choices: assets.map((asset) => ({
        assetId: String(asset.id),
        fileName: asset.name,
        architecture: asset.architecture,
        sizeBytes: asset.size,
        format: asset.format,
      })),
    };
  }
  if (!assets[0]) {
    return {
      kind: "unavailable",
      message:
        "No supported installer was found for this device. Check the official releases.",
    };
  }
  return {
    kind: "available",
    option: downloadOption(assets[0], platform),
  };
}

function isDownloadable(
  asset: ReleaseAsset,
  repository: string,
  platform: Platform,
): boolean {
  return (
    asset.eligible &&
    asset.platform === platform &&
    isOfficialAssetUrl(asset.url, repository)
  );
}

function downloadOption(
  asset: ReleaseAsset,
  platform: Platform,
): RepositoryDownloadOption {
  return {
    platform,
    url: asset.url,
    label: asset.name,
    architecture: asset.architecture,
    format: asset.format,
    instructions: installationInstructions(asset.format),
  };
}
