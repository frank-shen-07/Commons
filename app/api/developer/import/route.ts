import { importRepository } from "@/lib/publishing/github";
import { PortalError } from "@/lib/publishing/config";
export async function GET(request: Request) {
 try { const repository = new URL(request.url).searchParams.get("repository") ?? ""; return Response.json(await importRepository(repository, process.env.GITHUB_TOKEN || undefined), { headers: { "Cache-Control": "no-store" } }); }
 catch (error) { return Response.json({ error: error instanceof PortalError ? error.message : "GitHub is unavailable. Try again shortly." }, { status: error instanceof PortalError ? error.status : 502 }); }
}
