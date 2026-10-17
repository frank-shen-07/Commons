import { github } from "@/lib/publishing/github";
import { classifyAsset } from "@/lib/publishing/assets";
import { repositoryName, isOfficialAssetUrl } from "@/lib/publishing/validation";
import { PortalError } from "@/lib/publishing/config";
export async function GET(request: Request) {
 try {
 const query = new URL(request.url).searchParams;
 let repository: string; try { repository = repositoryName(query.get("repository") ?? ""); } catch { throw new PortalError("Choose a valid public repository."); }
 const releaseId = query.get("releaseId") ?? "", assetId = query.get("assetId") ?? "";
 if (!/^\d{1,16}$/.test(releaseId) || !/^\d{1,16}$/.test(assetId)) throw new PortalError("Choose a valid release and installer.");
 const release = await github<{ id: number; draft: boolean; prerelease: boolean; assets: Parameters<typeof classifyAsset>[0][] }>(`/repos/${repository}/releases/${releaseId}`);
 if (release.draft || release.prerelease) throw new PortalError("Only stable public releases are supported.");
 const raw = release.assets.find(a => String(a.id) === assetId);
 if (!raw) throw new PortalError("This installer is no longer available.", 404);
 const asset = classifyAsset(raw, release.id);
 if (!asset.eligible || asset.platform !== query.get("platform")) throw new PortalError("This installer does not match the selected platform.");
 if (!isOfficialAssetUrl(asset.url, repository)) throw new PortalError("GitHub returned an unsupported download destination.");
 return new Response(null, { status: 302, headers: { Location: asset.url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
 } catch (error) { return Response.json({ error: error instanceof PortalError ? error.message : "The download is unavailable. Return to the listing and try again." }, { status: error instanceof PortalError ? error.status : 502 }); }
}
