import type { Platform } from "../types";
export type Architecture = "x64" | "arm64" | "x86" | "universal" | "unknown";
export interface ReleaseAsset { id: number; releaseId: number; name: string; size: number; url: string; platform: Platform | null; architecture: Architecture; format: string; eligible: boolean; reason: string; }
export interface ImportedRelease { id: number; version: string; publishedAt: string | null; notes: string; url: string; assets: ReleaseAsset[]; }
export interface RepositoryImport { id: number; fullName: string; name: string; description: string; url: string; websiteUrl: string; owner: string; avatarUrl: string; license: string | null; readme: string; releases: ImportedRelease[]; }
export interface ListingInput { repository: string; name: string; summary: string; description: string; category: string; screenshots: string[]; iconUrl: string; websiteUrl: string; webUrl: string; releaseId: number | null; assets: { id: number; platform: Platform; architecture: Architecture }[]; }
