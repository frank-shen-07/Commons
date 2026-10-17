import "server-only";
import { PortalError } from "./config";
import { classifyAsset } from "./assets";
import { repositoryName } from "./validation";
export { repositoryName } from "./validation";
import type { RepositoryImport } from "./types";
export async function github<T>(path: string, token?: string): Promise<T> {
 const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" });
 if (!response.ok) throw new PortalError(response.status === 403 || response.status === 429 ? "GitHub access was denied or its request limit was reached. Check repository access and try again later." : response.status === 401 ? "Your GitHub session expired. Sign in again." : "GitHub could not find this repository or release.", response.status === 401 ? 401 : 422);
 return response.json();
}
interface Repo { id: number; full_name: string; name: string; description: string | null; private: boolean; archived: boolean; html_url: string; homepage: string | null; owner: { login: string; avatar_url: string }; license: { spdx_id: string } | null; permissions?: { admin: boolean; maintain: boolean; push: boolean }; }
interface Release { id: number; tag_name: string; published_at: string | null; body: string | null; html_url: string; draft: boolean; prerelease: boolean; assets: Parameters<typeof classifyAsset>[0][]; }
export async function importRepository(value: string, token?: string): Promise<RepositoryImport> {
 let name: string; try { name = repositoryName(value); } catch { throw new PortalError("Enter a public GitHub URL or owner/repository."); }
 const path = `/repos/${name}`;
 const repo = await github<Repo>(path, token);
 if (repo.private || repo.archived) throw new PortalError("Choose a public, active repository.");

 const releases = await github<Release[]>(`${path}/releases?per_page=20`, token);
 let readme = "";
 try { const result = await github<{ content: string; encoding: string }>(`${path}/readme`, token); if (result.encoding === "base64") readme = Buffer.from(result.content, "base64").toString("utf8").slice(0, 30000); } catch { /* README is optional; release and permission errors are not. */ }
 return { id: repo.id, fullName: repo.full_name, name: repo.name, description: repo.description ?? "", url: repo.html_url, websiteUrl: repo.homepage ?? "", owner: repo.owner.login, avatarUrl: repo.owner.avatar_url, license: repo.license?.spdx_id === "NOASSERTION" ? null : repo.license?.spdx_id ?? null, readme, releases: releases.filter(r => !r.draft && !r.prerelease).map(r => ({ id: r.id, version: r.tag_name, publishedAt: r.published_at, notes: (r.body ?? "").slice(0, 20000), url: r.html_url, assets: r.assets.map(a => classifyAsset(a, r.id)) })) };
}
