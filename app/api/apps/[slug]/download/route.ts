import { ApiError, errorResponse } from "@/lib/backend/errors";
import { createSupabaseServerClient } from "@/lib/backend/supabase";
import {
  apiUuidSchema,
  platformSchema,
  safeExternalHttps,
} from "@/lib/backend/validation";
import { resolveDownload } from "@/lib/backend/download-selection";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const query = new URL(request.url).searchParams,
      platform = platformSchema.safeParse(query.get("platform"));
    if (!platform.success)
      throw new ApiError(
        "Choose a supported platform.",
        422,
        "INVALID_PLATFORM",
      );
    const architecture = query.get("architecture"),
      assetId = query.get("assetId");
    if (
      architecture &&
      !["x64", "arm64", "x86", "universal", "unknown"].includes(architecture)
    )
      throw new ApiError(
        "Choose a supported architecture.",
        422,
        "INVALID_ARCHITECTURE",
      );
    if (assetId && !apiUuidSchema.safeParse(assetId).success)
      throw new ApiError("Choose a valid installer.", 422, "INVALID_ASSET");
    const supabase = await createSupabaseServerClient();
    const { data: app, error } = await supabase
      .from("applications")
      .select(
        "id, web_url, repository_owner, repository_name, distribution_selection",
      )
      .eq("slug", (await params).slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!app) throw new ApiError("Application not found.", 404, "NOT_FOUND");
    if (platform.data === "web") {
      const url = safeExternalHttps(app.web_url);
      if (!url)
        throw new ApiError("No web app is available.", 404, "ASSET_NOT_FOUND");
      return Response.json(
        { data: { platform: "web", url, label: "Open web app" } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const { data: version, error: versionError } = await supabase
      .from("application_versions")
      .select("id, github_release_id")
      .eq("application_id", app.id)
      .order("released_at", { ascending: false, nullsFirst: false })
      .order("id")
      .limit(1)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!version)
      throw new ApiError(
        "No approved release is available.",
        404,
        "ASSET_NOT_FOUND",
      );
    const { data: assets, error: assetError } = await supabase
      .from("release_assets")
      .select(
        "id, github_asset_id, file_name, download_url, architecture, file_size_bytes",
      )
      .eq("version_id", version.id)
      .eq("platform", platform.data)
      .in("kind", ["installer", "portable"]);
    if (assetError) throw assetError;
    const selection = app.distribution_selection as {
      releaseId: number | null;
      assets: Array<{ id: number }>;
    } | null;
    const approved = selection
      ? assets.filter(
          (a) =>
            selection.releaseId === version.github_release_id &&
            selection.assets.some((chosen) => chosen.id === a.github_asset_id),
        )
      : assets;
    const data = resolveDownload(
      approved,
      `${app.repository_owner}/${app.repository_name}`,
      platform.data,
      assetId,
      architecture,
    );
    return Response.json(
      { data },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
