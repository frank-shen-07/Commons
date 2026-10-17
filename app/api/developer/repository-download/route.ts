import { repositoryName } from "@/lib/publishing/validation";
import { importRepository } from "@/lib/publishing/github";
import { PortalError } from "@/lib/publishing/config";
import type { Platform } from "@/lib/types";
import { resolveRepositoryDownload } from "@/lib/publishing/repository-download";

function isSupportedPlatform(
  value: string | null,
): value is Exclude<Platform, "web"> {
  return value === "windows" || value === "macos" || value === "linux";
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    let repository: string;
    try {
      repository = repositoryName(query.get("repository") ?? "");
    } catch {
      throw new PortalError("Choose a valid public repository.");
    }

    const platform = query.get("platform");
    if (!isSupportedPlatform(platform)) {
      throw new PortalError("Choose a supported desktop platform.");
    }

    // Optional server token lifts GitHub's shared-IP anonymous limit (60/hour).
    const imported = await importRepository(
      repository,
      process.env.GITHUB_TOKEN || undefined,
    );
    const resolution = resolveRepositoryDownload(
      imported.releases,
      repository,
      platform,
      query.get("assetId"),
    );
    if (resolution.kind === "unavailable") {
      throw new PortalError(
        resolution.message,
        404,
      );
    }
    if (resolution.kind === "choices") {
      return Response.json(
        {
          error: {
            code: "ASSET_SELECTION_REQUIRED",
            message: "Choose the installer that matches your device.",
            details: resolution.choices,
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { data: resolution.option },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: {
          message:
            error instanceof PortalError
              ? error.message
              : "GitHub is unavailable. Try again shortly.",
        },
      },
      {
        status: error instanceof PortalError ? error.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
