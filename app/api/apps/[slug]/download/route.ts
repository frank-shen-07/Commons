import { ApiError, errorResponse } from "@/lib/backend/errors";
import { createSupabaseServerClient } from "@/lib/backend/supabase";
import { platformSchema } from "@/lib/backend/validation";
import { isOfficialAssetUrl } from "@/lib/publishing/validation";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const query = new URL(request.url).searchParams;
    const platform = platformSchema.safeParse(query.get("platform"));
    if (!platform.success) throw new ApiError("Choose a supported platform.", 422, "INVALID_PLATFORM");
    const architecture = query.get("architecture");
    if (architecture && !["x64", "arm64", "x86", "universal", "unknown"].includes(architecture)) {
      throw new ApiError("Choose a supported architecture.", 422, "INVALID_ARCHITECTURE");
    }
    const supabase = await createSupabaseServerClient();
    const { data: app, error: appError } = await supabase.from("applications").select("id, web_url, repository_owner, repository_name").eq("slug", slug).eq("status", "published").maybeSingle();
    if (appError) throw appError;
    if (!app) throw new ApiError("Application not found.", 404, "NOT_FOUND");
    if (platform.data === "web" && app.web_url) {
      return Response.json({ data: { platform: "web", url: app.web_url, label: "Open web app" } }, {
        headers: { "Cache-Control": "public, max-age=60", "Referrer-Policy": "no-referrer" },
      });
    }
    const { data: versions, error: versionError } = await supabase.from("application_versions").select("id, version").eq("application_id", app.id).order("released_at", { ascending: false, nullsFirst: false });
    if (versionError) throw versionError;
    const { data: assets, error: assetError } = versions?.length
      ? await supabase.from("release_assets").select("file_name, download_url, platform, architecture, kind, version_id").in("version_id", versions.map((version) => version.id)).eq("platform", platform.data).in("kind", ["installer", "portable"])
      : { data: [], error: null };
    if (assetError) throw assetError;
    let candidates = assets ?? [];
    const versionOrder = new Map((versions ?? []).map((version, index) => [version.id, index]));
    candidates.sort((left, right) =>
      (versionOrder.get(left.version_id) ?? Number.MAX_SAFE_INTEGER) - (versionOrder.get(right.version_id) ?? Number.MAX_SAFE_INTEGER)
      || left.file_name.localeCompare(right.file_name),
    );
    if (architecture) candidates = candidates.filter((asset) => asset.architecture === architecture);
    if (!candidates.length) throw new ApiError("No compatible release asset is available.", 404, "ASSET_NOT_FOUND");
    if (!architecture && (candidates.length > 1 || candidates.some((asset) => asset.architecture === "unknown"))) {
      throw new ApiError("Select a release asset and architecture before downloading.", 409, "ASSET_SELECTION_REQUIRED", candidates.map((asset) => ({
        fileName: asset.file_name,
        architecture: asset.architecture,
      })));
    }
    const selected = candidates[0];
    if (!isOfficialAssetUrl(selected.download_url, `${app.repository_owner}/${app.repository_name}`)) {
      throw new ApiError("Release download URL is invalid.", 502, "INVALID_DOWNLOAD_URL");
    }
    return Response.json({
      data: {
        platform: platform.data,
        url: selected.download_url,
        label: selected.file_name,
      },
    }, { headers: { "Cache-Control": "public, max-age=60", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    return errorResponse(error);
  }
}
