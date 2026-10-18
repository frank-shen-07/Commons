// Adds screenshots to published apps that have none, using the official
// AppStream screenshots each project publishes on Flathub.
//
//   node --env-file=.env scripts/backfill-screenshots.ts           # dry run
//   node --env-file=.env scripts/backfill-screenshots.ts --apply   # write
//
// Each app is matched by searching Flathub for its name, and a hit is only
// used when its AppStream source or homepage URL points at the same GitHub
// repository or website as the listing. Apps that already have screenshots
// are never touched, so it is safe to re-run (e.g. after seed-apps.ts).
import { createClient } from "@supabase/supabase-js";

const MAX_SCREENSHOTS = 3;
// The gallery renders at most ~900px wide; prefer the smallest rendition at
// least this wide over the multi-megabyte originals.
const TARGET_WIDTH = 1000;
const apply = process.argv.includes("--apply");

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } =
  process.env;
if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Run with --env-file=.env",
  );
  process.exit(1);
}
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface AppStream {
  id: string;
  name: string;
  urls?: Record<string, string | null>;
  screenshots?: Array<{
    caption?: string;
    sizes?: Array<{ src: string; width: string; height: string }>;
  }>;
}

async function json<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${response.status} ${input}`);
  return response.json() as Promise<T>;
}

const normalizeRepo = (value: string) =>
  value
    .toLowerCase()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
const host = (value: string | null | undefined) => {
  try {
    return value ? new URL(value).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

function matches(
  stream: AppStream,
  app: { repository_url: string; website_url: string | null },
) {
  const urls = Object.values(stream.urls ?? {}).filter(
    (u): u is string => typeof u === "string",
  );
  if (urls.some((u) => normalizeRepo(u) === normalizeRepo(app.repository_url)))
    return true;
  const site = host(app.website_url);
  return !!site && host(stream.urls?.homepage) === site;
}

function pickSize(sizes: NonNullable<AppStream["screenshots"]>[number]["sizes"]) {
  const usable = (sizes ?? [])
    .filter((s) => s.src.startsWith("https://"))
    .sort((a, b) => Number(a.width) - Number(b.width));
  return (
    usable.find((s) => Number(s.width) >= TARGET_WIDTH) ?? usable.at(-1) ?? null
  );
}

// Official Flathub IDs whose AppStream URLs don't name the listing's repo or
// site (Firefox's points at mozilla.org, the listing at firefox.com).
const knownIds: Record<string, string> = { firefox: "org.mozilla.firefox" };

async function findOnFlathub(app: {
  slug: string;
  name: string;
  repository_url: string;
  website_url: string | null;
}) {
  if (knownIds[app.slug])
    return json<AppStream>(
      `https://flathub.org/api/v2/appstream/${knownIds[app.slug]}`,
    );
  const search = await json<{ hits: Array<{ app_id: string }> }>(
    "https://flathub.org/api/v2/search",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: app.name }),
    },
  );
  for (const hit of search.hits.slice(0, 5)) {
    const stream = await json<AppStream>(
      `https://flathub.org/api/v2/appstream/${encodeURIComponent(hit.app_id)}`,
    ).catch(() => null);
    if (stream && matches(stream, app)) return stream;
  }
  return null;
}

const { data: apps, error } = await db
  .from("applications")
  .select("id, slug, name, repository_url, website_url, application_screenshots(id)")
  .eq("status", "published")
  .order("slug");
if (error) throw error;

for (const app of apps ?? []) {
  if (app.application_screenshots.length) continue;
  const stream = await findOnFlathub(app).catch((e: Error) => {
    console.warn(`${app.slug}: Flathub lookup failed (${e.message})`);
    return null;
  });
  if (!stream) {
    console.log(`${app.slug}: no verified Flathub listing, skipped`);
    continue;
  }
  const rows = (stream.screenshots ?? [])
    .map((shot) => ({ shot, size: pickSize(shot.sizes) }))
    .filter((entry) => entry.size)
    .slice(0, MAX_SCREENSHOTS)
    .map(({ shot, size }, order) => ({
      application_id: app.id,
      image_url: size!.src,
      alt_text: (shot.caption?.trim() || `${app.name} screenshot ${order + 1}`).slice(0, 300),
      display_order: order,
    }));
  console.log(
    `${app.slug}: ${rows.length} screenshot(s) from ${stream.id}${apply ? "" : " (dry run)"}`,
  );
  for (const row of rows) console.log(`    ${row.image_url}`);
  if (apply && rows.length) {
    const { error: insertError } = await db
      .from("application_screenshots")
      .insert(rows);
    if (insertError) throw insertError;
  }
}
