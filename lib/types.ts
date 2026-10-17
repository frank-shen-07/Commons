export const platforms = ["windows", "macos", "linux", "web"] as const;
export type Platform = (typeof platforms)[number];
export const platformLabels: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  web: "Web",
};
export const categories = [
  "Productivity",
  "Creativity",
  "Developer Tools",
  "Utilities",
  "Education",
  "Security & Privacy",
  "Communication",
  "Entertainment",
];
export interface MarketplaceApp {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  iconUrl: string | null;
  screenshots: string[];
  category: string;
  developerName: string;
  repositoryUrl: string;
  websiteUrl: string;
  license: string | null;
  latestVersion: string | null;
  updatedAt: string | null;
  platforms: Platform[];
  featured?: boolean;
  color: string;
  features: string[];
  developer?: AppDeveloper;
  compatibility?: AppCompatibility[];
  release?: AppRelease;
  releasesUrl?: string;
}
// Published download response (inside the API data envelope).
export interface DownloadOption {
  architecture?: string;
  format?: string;
  instructions?: string;
  platform: Platform;
  url: string;
  label: string;
}

// Optional enrichment contracts; normalize the team's responses in lib/api.ts.
export interface AppDeveloper {
  name: string;
  websiteUrl?: string;
  avatarUrl?: string;
}
export interface AppCompatibility {
  platform: Platform;
  minimumVersion?: string;
  architecture?: string;
}
export interface AppRelease {
  version: string;
  publishedAt?: string;
  notes?: string;
  releasesUrl?: string;
  fileSizeBytes?: number;
}
export interface AppCategory {
  id: string;
  name: string;
}
