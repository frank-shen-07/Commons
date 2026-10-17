export function repositoryName(value: string): string {
 const clean = value.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/$/, "").replace(/\.git$/, "");
 if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(clean) || [".", ".."].includes(clean.split("/")[1])) throw new Error("Enter a public GitHub URL or owner/repository.");
 return clean;
}
export function isOfficialAssetUrl(value: string, repository: string): boolean {
 try { const url = new URL(value), segments = url.pathname.split("/").filter(Boolean); return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password && !url.port && segments.slice(0,2).join("/").toLowerCase() === repository.toLowerCase() && segments[2] === "releases" && segments[3] === "download" && segments.length >= 6; } catch { return false; }
}
