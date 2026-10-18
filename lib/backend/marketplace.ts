import type { Database, ReleasePlatform } from "@/src/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type AppRow = Database["public"]["Tables"]["applications"]["Row"];
type VersionSummary = Pick<
  Database["public"]["Tables"]["application_versions"]["Row"],
  "id" | "application_id" | "version" | "released_at"
>;

export function publicApplication(
  row: AppRow,
  extra: Record<string, unknown> = {},
) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    iconUrl: row.icon_url,
    repositoryUrl: row.repository_url,
    websiteUrl: row.website_url,
    webUrl: row.web_url,
    license: row.license,
    featured: row.featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    ...extra,
  };
}

export async function applicationSummaryRelations(
  supabase: SupabaseClient<Database>,
  apps: AppRow[],
) {
  if (!apps.length) return new Map<string, Record<string, unknown>>();
  const ids = apps.map((app) => app.id);
  const [categoryRows, screenshotRows, versionRows, publisherRows] =
    await Promise.all([
      supabase
        .from("application_categories")
        .select("application_id, category_id")
        .in("application_id", ids),
      supabase
        .from("application_screenshots")
        .select("application_id, image_url")
        .in("application_id", ids)
        .order("display_order"),
      supabase
        .from("application_versions")
        .select("id, application_id, version, released_at")
        .in("application_id", ids)
        .order("released_at", { ascending: false, nullsFirst: false })
        .order("id"),
      supabase
        .from("developer_profiles")
        .select("user_id, github_username, display_name, avatar_url")
        .in(
          "user_id",
          apps.flatMap((app) => (app.publisher_id ? [app.publisher_id] : [])),
        ),
    ]);
  for (const result of [
    categoryRows,
    screenshotRows,
    versionRows,
    publisherRows,
  ]) {
    if (result.error) throw result.error;
  }
  const categoryIds = [
    ...new Set((categoryRows.data ?? []).map((item) => item.category_id)),
  ];
  // Started here, awaited alongside the asset lookup (they're independent).
  const categoriesQuery = categoryIds.length
    ? supabase.from("categories").select("id, name, slug").in("id", categoryIds)
    : Promise.resolve({ data: [], error: null });
  const byPublisher = new Map(
    (publisherRows.data ?? []).map((publisher) => [
      publisher.user_id,
      publisher,
    ]),
  );
  const latestVersions = new Map<string, VersionSummary>();
  for (const version of versionRows.data ?? []) {
    if (!latestVersions.has(version.application_id))
      latestVersions.set(version.application_id, version);
  }
  const latestVersionIds = [...latestVersions.values()].map(
    (version) => version.id,
  );
  const appByVersionId = new Map(
    [...latestVersions.values()].map((version) => [
      version.id,
      version.application_id,
    ]),
  );
  const [categories, latestAssets] = await Promise.all([
    categoriesQuery,
    latestVersionIds.length
      ? supabase
          .from("release_assets")
          .select("version_id, platform")
          .in("version_id", latestVersionIds)
          .in("kind", ["installer", "portable"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (latestAssets.error) throw latestAssets.error;
  if (categories.error) throw categories.error;
  const byCategory = new Map(
    (categories.data ?? []).map((category) => [category.id, category]),
  );
  const platformsByApp = new Map<string, Set<string>>();
  for (const asset of latestAssets.data ?? []) {
    if (asset.platform === "unknown") continue;
    const applicationId = appByVersionId.get(asset.version_id);
    if (!applicationId) continue;
    const current = platformsByApp.get(applicationId) ?? new Set<string>();
    current.add(asset.platform);
    platformsByApp.set(applicationId, current);
  }
  const result = new Map<string, Record<string, unknown>>();
  for (const app of apps) {
    const appCategoryIds = (categoryRows.data ?? [])
      .filter((item) => item.application_id === app.id)
      .map((item) => item.category_id);
    const publisher = app.publisher_id
      ? byPublisher.get(app.publisher_id)
      : null;
    const version = latestVersions.get(app.id);
    const platformSet = platformsByApp.get(app.id) ?? new Set<string>();
    if (app.web_url) platformSet.add("web");
    result.set(app.id, {
      category:
        appCategoryIds
          .map((id) => byCategory.get(id)?.name)
          .filter((name): name is string => !!name)[0] ?? null,
      categories: appCategoryIds
        .map((id) => byCategory.get(id))
        .filter(Boolean),
      screenshots: (screenshotRows.data ?? [])
        .filter((image) => image.application_id === app.id)
        .map((image) => image.image_url),
      developerName: publisher
        ? publisher.display_name || publisher.github_username
        : "Unknown publisher",
      developer: publisher
        ? {
            username: publisher.github_username,
            name: publisher.display_name || publisher.github_username,
            avatarUrl: publisher.avatar_url,
          }
        : null,
      latestVersion: version?.version ?? null,
      platforms: [...platformSet],
    });
  }
  return result;
}

export async function applicationRelations(
  supabase: SupabaseClient<Database>,
  apps: AppRow[],
) {
  if (!apps.length) return new Map<string, Record<string, unknown>>();
  const ids = apps.map((app) => app.id);
  const [categoryRows, screenshotRows, versions, publisherRows] =
    await Promise.all([
      supabase
        .from("application_categories")
        .select("application_id, category_id")
        .in("application_id", ids),
      supabase
        .from("application_screenshots")
        .select("application_id, image_url, alt_text, display_order")
        .in("application_id", ids)
        .order("display_order"),
      supabase
        .from("application_versions")
        .select("*")
        .in("application_id", ids)
        .order("released_at", { ascending: false, nullsFirst: false })
        .order("id"),
      supabase
        .from("developer_profiles")
        .select("user_id, github_username, display_name, avatar_url")
        .in(
          "user_id",
          apps.flatMap((app) => (app.publisher_id ? [app.publisher_id] : [])),
        ),
    ]);
  for (const result of [
    categoryRows,
    screenshotRows,
    versions,
    publisherRows,
  ]) {
    if (result.error) throw result.error;
  }
  const categoryIds = [
    ...new Set((categoryRows.data ?? []).map((item) => item.category_id)),
  ];
  // Started here, awaited alongside the asset lookup (they're independent).
  const categoriesQuery = categoryIds.length
    ? supabase.from("categories").select("id, name, slug").in("id", categoryIds)
    : Promise.resolve({ data: [], error: null });
  const byPublisher = new Map(
    (publisherRows.data ?? []).map((publisher) => [
      publisher.user_id,
      publisher,
    ]),
  );
  const versionRows = versions.data ?? [];
  const [categories, assetRows] = await Promise.all([
    categoriesQuery,
    versionRows.length
      ? supabase
          .from("release_assets")
          .select("*")
          .in(
            "version_id",
            versionRows.map((version) => version.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (assetRows.error) throw assetRows.error;
  if (categories.error) throw categories.error;
  const byCategory = new Map(
    (categories.data ?? []).map((category) => [category.id, category]),
  );
  const assetsByVersion = new Map<string, typeof assetRows.data>();
  for (const asset of assetRows.data ?? []) {
    const current = assetsByVersion.get(asset.version_id) ?? [];
    current.push(asset);
    assetsByVersion.set(asset.version_id, current);
  }
  const versionsByApp = new Map<string, Record<string, unknown>[]>();
  for (const version of versionRows) {
    const records = versionsByApp.get(version.application_id) ?? [];
    const releaseAssets = (assetsByVersion.get(version.id) ?? []).map(
      (asset) => ({
        id: asset.id,
        fileName: asset.file_name,
        downloadUrl: asset.download_url,
        mimeType: asset.mime_type,
        sizeBytes: asset.file_size_bytes,
        platform: asset.platform,
        architecture: asset.architecture,
        kind: asset.kind,
      }),
    );
    records.push({
      id: version.id,
      version: version.version,
      tag: version.git_tag,
      name: version.release_name,
      notes: version.release_notes,
      url: version.github_release_url,
      releasedAt: version.released_at,
      prerelease: version.prerelease,
      assets: releaseAssets,
    });
    versionsByApp.set(version.application_id, records);
  }
  const result = new Map<string, Record<string, unknown>>();
  for (const app of apps) {
    const appCategoryIds = (categoryRows.data ?? [])
      .filter((item) => item.application_id === app.id)
      .map((item) => item.category_id);
    const publisher = app.publisher_id
      ? byPublisher.get(app.publisher_id)
      : null;
    const appVersions = versionsByApp.get(app.id) ?? [];
    const screenshotList = (screenshotRows.data ?? []).filter(
      (image) => image.application_id === app.id,
    );
    result.set(app.id, {
      category:
        appCategoryIds
          .map((id) => byCategory.get(id)?.name)
          .filter((name): name is string => !!name)[0] ?? null,
      categories: appCategoryIds
        .map((id) => byCategory.get(id))
        .filter(Boolean),
      screenshots: screenshotList.map(({ image_url }) => image_url),
      screenshotDetails: screenshotList.map(
        ({ image_url, alt_text, display_order }) => ({
          url: image_url,
          alt: alt_text,
          order: display_order,
        }),
      ),
      developerName: publisher
        ? publisher.display_name || publisher.github_username
        : "Unknown publisher",
      developer: publisher
        ? {
            username: publisher.github_username,
            name: publisher.display_name || publisher.github_username,
            avatarUrl: publisher.avatar_url,
          }
        : null,
      versions: appVersions,
      platforms: [
        ...new Set([
          ...(
            appVersions.slice(0, 1) as Array<{
              assets: Array<{ platform: string; kind: string }>;
            }>
          ).flatMap((version) =>
            version.assets
              .filter(
                (asset) =>
                  asset.kind === "installer" || asset.kind === "portable",
              )
              .map((asset) => asset.platform)
              .filter((platform) => platform !== "unknown"),
          ),
          ...(app.web_url ? ["web"] : []),
        ]),
      ],
      latestVersion:
        (appVersions[0] as { version?: string } | undefined)?.version ?? null,
    });
  }
  return result;
}

export async function matchingApplicationIds(
  supabase: SupabaseClient<Database>,
  platform: ReleasePlatform,
): Promise<string[]> {
  const { data: versions, error: versionError } = await supabase
    .from("application_versions")
    .select("id, application_id")
    .order("released_at", { ascending: false, nullsFirst: false })
    .order("id");
  if (versionError) throw versionError;
  const latest = new Map<string, string>();
  for (const version of versions ?? [])
    if (!latest.has(version.application_id))
      latest.set(version.application_id, version.id);
  if (!latest.size) return [];
  const { data: assets, error: assetError } = await supabase
    .from("release_assets")
    .select("version_id")
    .in("version_id", [...latest.values()])
    .eq("platform", platform)
    .in("kind", ["installer", "portable"]);
  if (assetError) throw assetError;
  const eligible = new Set((assets ?? []).map((asset) => asset.version_id));
  return [...latest]
    .filter(([, version]) => eligible.has(version))
    .map(([app]) => app);
}

export function escapedSearch(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9 ._'-]/g, " ")
    .replace(/[%_]/g, " ")
    .trim()
    .slice(0, 100);
}
