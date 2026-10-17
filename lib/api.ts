import { fixtureApps } from "./fixtures";
import { categories, type MarketplaceApp } from "./types";
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
export async function getApps(): Promise<MarketplaceApp[]> {
  return apiBase ? request("/apps") : fixtureApps;
}
export async function getCategories(): Promise<string[]> {
  return apiBase ? request("/categories") : categories;
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
  return response.json();
}
