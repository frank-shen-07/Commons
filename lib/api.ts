import { fixtureApps } from "./fixtures";
import { categories, platforms, type MarketplaceApp, type Platform } from "./types";
import type { Application, Category, PaginatedResponse } from "@/src/types/api";
// Server-side only. This adapter is the sole integration point for Member 2.
const apiBase = process.env.MARKETPLACE_API_URL;
export const usingFixtures = !apiBase;
async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      "The marketplace is temporarily unavailable. Please try again.",
    );
  return response.json() as Promise<T>;
}
function normalizeApp(app: Application | import("@/src/types/api").ApplicationSummary): MarketplaceApp {
  const supportedPlatforms = app.platforms.filter((platform): platform is Platform =>
    platforms.includes(platform as Platform),
  );
  const version = "versions" in app ? app.versions[0] : undefined;
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    summary: app.summary,
    description: "description" in app ? app.description : app.summary,
    iconUrl: app.iconUrl,
    screenshots: app.screenshots,
    category: app.category ?? "Uncategorized",
    developerName: app.developerName,
    repositoryUrl: app.repositoryUrl,
    websiteUrl: ("websiteUrl" in app ? app.websiteUrl : null) ?? "",
    license: app.license,
    latestVersion: app.latestVersion,
    updatedAt: app.updatedAt,
    platforms: supportedPlatforms,
    featured: app.featured,
    color: "#eaf1ff",
    features: [],
    developer: app.developer ? {
      name: app.developer.name,
      websiteUrl: undefined,
      avatarUrl: app.developer.avatarUrl ?? undefined,
    } : undefined,
    release: version ? {
      version: version.version,
      publishedAt: version.releasedAt ?? undefined,
      notes: version.notes,
      releasesUrl: version.url,
    } : undefined,
    releasesUrl: version?.url,
  };
}
export async function getApps(): Promise<MarketplaceApp[]> {
  if (!apiBase) return fixtureApps;
  const result = await request<PaginatedResponse<Application>>("/apps?limit=50");
  return result.data.map(normalizeApp);
}
export async function getCategories(): Promise<string[]> {
  if (!apiBase) return categories;
  const result = await request<{ data: Category[] }>("/categories");
  return result.data.map((category) => category.name);
}
export async function getApp(slug: string): Promise<MarketplaceApp | null> {
  if (!apiBase) return fixtureApps.find((app) => app.slug === slug) ?? null;
  const response = await fetch(`${apiBase}/apps/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error("We couldn’t load this app. Please try again.");
  const result = await response.json() as { data: Application };
  return normalizeApp(result.data);
}
