import { ApiError } from "./errors.ts";
import { installationInstructions } from "../publishing/assets.ts";
import { isOfficialAssetUrl } from "../publishing/validation.ts";
export interface DownloadCandidate {
  id: string;
  file_name: string;
  download_url: string;
  architecture: string;
  file_size_bytes: number | null;
}
export function resolveDownload(
  candidates: DownloadCandidate[],
  repository: string,
  platform: string,
  assetId?: string | null,
  architecture?: string | null,
) {
  let matches = candidates.filter((a) =>
    isOfficialAssetUrl(a.download_url, repository),
  );
  if (architecture)
    matches = matches.filter((a) => a.architecture === architecture);
  if (assetId) matches = matches.filter((a) => a.id === assetId);
  if (!matches.length)
    throw new ApiError(
      "No matching approved installer is available. Choose another device or installer.",
      404,
      "ASSET_NOT_FOUND",
    );
  if (
    matches.length > 1 ||
    (!assetId && matches[0].architecture === "unknown")
  ) {
    throw new ApiError(
      "Choose the installer for your device.",
      409,
      "ASSET_SELECTION_REQUIRED",
      matches.map((a) => ({
        assetId: a.id,
        fileName: a.file_name,
        architecture: a.architecture,
        sizeBytes: a.file_size_bytes,
        format: a.file_name.split(".").pop()?.toLowerCase() ?? "",
      })),
    );
  }
  const asset = matches[0],
    format = asset.file_name.split(".").pop()?.toLowerCase() ?? "";
  return {
    platform,
    url: asset.download_url,
    label: asset.file_name,
    architecture: asset.architecture,
    format,
    instructions: installationInstructions(format),
  };
}
