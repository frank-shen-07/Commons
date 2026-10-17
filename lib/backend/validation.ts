import { z } from "zod";
import { repositoryName } from "../publishing/validation.ts";

const httpsUrl = z.string().trim().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use a valid HTTPS URL.");
const githubRepository = z.string().trim().min(1).max(200).refine((value) => {
  try {
    repositoryName(value);
    return true;
  } catch {
    return false;
  }
}, "Use a GitHub repository URL or owner/repository.");
const screenshotSchema = z.union([
  httpsUrl,
  z.object({ url: httpsUrl, alt: z.string().trim().max(300).default("") }).strict(),
]);

export const listingSchema = z.object({
  repository: githubRepository,
  name: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(10000),
  category: z.string().trim().min(1).max(80),
  screenshots: z.array(screenshotSchema).max(10).default([]),
  iconUrl: httpsUrl.or(z.literal("")).default(""),
  websiteUrl: httpsUrl.or(z.literal("")).default(""),
  webUrl: httpsUrl.or(z.literal("")).default(""),
  releaseId: z.number().int().positive().nullable().default(null),
  assets: z.array(z.object({
    id: z.number().int().positive(),
    platform: z.enum(["windows", "macos", "linux", "web"]),
    architecture: z.enum(["x64", "arm64", "x86", "universal", "unknown"]),
  })).max(50).default([]),
}).strict();

export const updateListingSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(10000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  screenshots: z.array(screenshotSchema).max(10).optional(),
  iconUrl: httpsUrl.or(z.literal("")).optional(),
  websiteUrl: httpsUrl.or(z.literal("")).optional(),
  webUrl: httpsUrl.or(z.literal("")).optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const profileSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  biography: z.string().trim().max(1000).nullable().optional(),
  avatarUrl: httpsUrl.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one profile field.");

export const reportSchema = z.object({
  reason: z.enum(["malware", "impersonation", "license", "broken", "other"]),
  details: z.string().trim().max(2000).nullable().optional(),
}).strict();

export const browseQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  platform: z.enum(["windows", "macos", "linux", "web", "android", "ios"]).optional(),
  sort: z.enum(["recent", "updated", "featured", "name"]).default("featured"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const apiUuidSchema = z.string().uuid();
export const platformSchema = z.enum(["windows", "macos", "linux", "web", "android", "ios"]);

export function slugify(value: string): string {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-+$/g, "");
  return slug || "application";
}

export function publicationEligible(input: {
  webUrl: string | null;
  hasCategory: boolean;
  hasOpenSourceLicense: boolean;
  hasStableRelease: boolean;
  hasCompatibleAsset: boolean;
}): boolean {
  return input.hasCategory
    && input.hasOpenSourceLicense
    && (Boolean(input.webUrl) || (input.hasStableRelease && input.hasCompatibleAsset));
}

export function safeExternalHttps(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = httpsUrl.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeScreenshots(screenshots: Array<string | { url: string; alt: string }>) {
  return screenshots.map((screenshot) => typeof screenshot === "string"
    ? { imageUrl: screenshot, altText: "" }
    : { imageUrl: screenshot.url, altText: screenshot.alt });
}
