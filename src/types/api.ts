import type {
  AssetKind,
  ApplicationStatus,
  ReleasePlatform,
} from "./database.types";

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
  developer: {
    username: string;
    name: string;
    avatarUrl: string | null;
  } | null;
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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
  assets?: Array<{
    id: number;
    platform: "windows" | "macos" | "linux" | "web";
    architecture: string;
  }>;
};

export type RepositoryVerification =
  import("../../lib/publishing/types").RepositoryImport & {
    repository: import("../../lib/publishing/types").RepositoryImport;
  };

export type { ApplicationStatus, AssetKind, ReleasePlatform };

export interface PublisherSession {
  id: string;
  githubUsername: string | null;
}
export type RevisionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected";
export interface PublisherSnapshot {
  input: PublishingRequest;
  repository: import("../../lib/publishing/types").RepositoryImport;
  categoryId: string;
}
export interface DeveloperListingSummary {
  id: string;
  slug: string;
  name: string;
  repository: string;
  status: ApplicationStatus;
  revisionStatus: RevisionStatus | null;
  version: number;
  updatedAt: string;
}
export interface DeveloperListing
  extends DeveloperListingSummary, PublishingRequest {
  createdAt: string;
  repositoryUrl: string;
  license: string | null;
  revisionId: string | null;
  snapshot: PublisherSnapshot;
}
export interface DownloadChoice {
  assetId: string;
  fileName: string;
  architecture: string;
  sizeBytes: number | null;
  format: string;
}
export interface ResolvedDownload {
  platform: Platform;
  url: string;
  label: string;
  architecture?: string;
  format?: string;
  instructions?: string;
}

export interface AdminRevisionSummary {
  id: string;
  version: number;
  status: RevisionStatus;
  name: string;
  repository: string;
  submittedAt: string;
  application: { id: string; slug: string; status: ApplicationStatus };
  publisher: { id: string | null; githubUsername: string; displayName: string };
  isUpdate: boolean;
}
export interface AdminRevisionDetail extends AdminRevisionSummary {
  snapshot: PublisherSnapshot;
}
export interface AdminApprovalRequest {
  expectedVersion: number;
}
export interface AdminApprovalResult {
  id: string;
  slug: string;
  status: "published";
}

export interface AdminApplicationLookup {
  id: string;
  slug: string;
  name: string;
  status: ApplicationStatus;
  repositoryUrl: string;
  publisher: { githubUsername: string; displayName: string };
  updatedAt: string;
}
export interface AdminApplicationDeletionRequest {
  confirmSlug: string;
  expectedUpdatedAt: string;
}
export interface AdminApplicationDeletionResult {
  id: string;
  slug: string;
  deleted: true;
}
export interface AdminApplicationLookupRequest {
  url: string;
}
