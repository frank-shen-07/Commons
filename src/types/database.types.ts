// Handwritten mirror of the migration; regenerate and review against Supabase before replacing.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ApplicationStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "suspended";
export type ReleasePlatform =
  | "windows"
  | "macos"
  | "linux"
  | "web"
  | "android"
  | "ios"
  | "unknown";
export type AssetKind = "installer" | "portable" | "web_app" | "source" | "other";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      developer_profiles: Table<
        { user_id: string; github_username: string; display_name: string; avatar_url: string | null; biography: string | null; created_at: string; updated_at: string },
        { user_id: string; github_username: string; display_name?: string; avatar_url?: string | null; biography?: string | null }
      >;
      categories: Table<
        { id: string; name: string; slug: string; created_at: string },
        { id?: string; name: string; slug: string; created_at?: string }
      >;
      applications: Table<
        { id: string; publisher_id: string | null; name: string; slug: string; summary: string; description: string; icon_url: string | null; repository_url: string; repository_owner: string; repository_name: string; github_repository_id: number; license: string | null; website_url: string | null; web_url: string | null; status: ApplicationStatus; featured: boolean; created_at: string; updated_at: string; published_at: string | null },
        { id?: string; publisher_id?: string | null; name: string; slug: string; summary: string; description: string; icon_url?: string | null; repository_url: string; repository_owner: string; repository_name: string; github_repository_id: number; license?: string | null; website_url?: string | null; web_url?: string | null; status?: ApplicationStatus; featured?: boolean; published_at?: string | null }
      >;
      application_categories: Table<{ application_id: string; category_id: string }, { application_id: string; category_id: string }>;
      application_versions: Table<
        { id: string; application_id: string; version: string; git_tag: string; release_name: string | null; release_notes: string; github_release_url: string; released_at: string | null; prerelease: boolean; github_release_id: number; created_at: string },
        { id?: string; application_id: string; version: string; git_tag: string; release_name?: string | null; release_notes?: string; github_release_url: string; released_at?: string | null; prerelease?: boolean; github_release_id: number }
      >;
      release_assets: Table<
        { id: string; version_id: string; github_asset_id: number; file_name: string; download_url: string; mime_type: string | null; file_size_bytes: number | null; platform: ReleasePlatform; architecture: string; kind: AssetKind; created_at: string },
        { id?: string; version_id: string; github_asset_id: number; file_name: string; download_url: string; mime_type?: string | null; file_size_bytes?: number | null; platform?: ReleasePlatform; architecture?: string; kind?: AssetKind }
      >;
      application_screenshots: Table<
        { id: string; application_id: string; image_url: string; alt_text: string; display_order: number; created_at: string },
        { id?: string; application_id: string; image_url: string; alt_text?: string; display_order?: number }
      >;
      application_reports: Table<
        { id: string; application_id: string; reporter_id: string | null; reason: "malware" | "impersonation" | "license" | "broken" | "other"; details: string | null; created_at: string },
        { id?: string; application_id: string; reporter_id: string | null; reason: "malware" | "impersonation" | "license" | "broken" | "other"; details?: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      application_status: ApplicationStatus;
      release_platform: ReleasePlatform;
      asset_kind: AssetKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
