import type { AssetKind, ApplicationStatus, ReleasePlatform } from "./database.types";

export type Platform = ReleasePlatform;

export interface DeveloperProfile {
  userId: string;
  githubUsername: string;
  displayName: string;
  avatarUrl: string | null;
  biography: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  applicationCount?: number;
}

export interface ReleaseAsset {
  id: string;
  fileName: string;
  downloadUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  platform: Platform;
  architecture: string;
  kind: AssetKind;
}

export interface ApplicationVersion {
  id: string;
  version: string;
  tag: string;
  name: string | null;
  notes: string;
  url: string;
  releasedAt: string | null;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface Application {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  iconUrl: string | null;
  repositoryUrl: string;
  websiteUrl: string | null;
  webUrl: string | null;
  license: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  category: string | null;
  categories: Category[];
  screenshots: string[];
  screenshotDetails?: Array<{ url: string; alt: string; order: number }>;
  developerName: string;
  developer: { username: string; name: string; avatarUrl: string | null } | null;
  versions: ApplicationVersion[];
  latestVersion: string | null;
  platforms: Platform[];
}

export type ApplicationSummary = Pick<
  Application,
  | "id"
  | "slug"
  | "name"
  | "summary"
  | "iconUrl"
  | "repositoryUrl"
  | "license"
  | "featured"
  | "publishedAt"
  | "updatedAt"
  | "category"
  | "screenshots"
  | "developer"
  | "developerName"
  | "latestVersion"
  | "platforms"
>;

export type ApplicationDetail = Application;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiErrorResponse {
  error: { code: string; message: string; details?: unknown };
}

export type PublishingRequest = {
  repository: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  screenshots?: Array<string | { url: string; alt: string }>;
  iconUrl?: string;
  websiteUrl?: string;
  webUrl?: string;
  releaseId?: number | null;
  assets?: Array<{ id: number; platform: "windows" | "macos" | "linux" | "web"; architecture: string }>;
};

export interface RepositoryVerification {
  repository: {
    id: number;
    fullName: string;
    name: string;
    description: string;
    url: string;
    owner: string;
    license: string | null;
  };
  releases: Array<{
    id: number;
    version: string;
    name: string | null;
    notes: string;
    url: string;
    publishedAt: string | null;
    assets: Array<{
      id: number;
      name: string;
      platform: "windows" | "macos" | "linux" | null;
      architecture: string;
      eligible: boolean;
      reason: string;
    }>;
  }>;
}

export type { ApplicationStatus, AssetKind, ReleasePlatform };
