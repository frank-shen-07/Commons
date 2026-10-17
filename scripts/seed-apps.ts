// Seeds the marketplace with well-known open-source applications.
//
//   GITHUB_TOKEN=$(gh auth token) node --env-file=.env scripts/seed-apps.ts
//
// Repository IDs, releases and installer assets are read live from GitHub, so
// every download URL is an official GitHub release asset. Projects that only
// mirror source to GitHub (VLC, LibreOffice, Blender, ...) are listed without
// installers; their pages fall back to the official website. Re-running the
// script refreshes the same rows instead of creating duplicates.
import { createClient } from "@supabase/supabase-js";
import { classifyAsset } from "../lib/publishing/assets.ts";

const raw = "https://raw.githubusercontent.com";

interface SeedApp {
  repo: string;
  name: string;
  publisher: string;
  summary: string;
  description: string;
  categories: string[];
  license: string;
  websiteUrl: string;
  iconUrl: string;
  screenshots?: Array<{ url: string; alt: string }>;
  featured?: boolean;
  // Only releases whose tag starts with this prefix (monorepos).
  tagPrefix?: string;
}

// Listing order: the first entry is the most recently published.
const apps: SeedApp[] = [
  {
    repo: "obsproject/obs-studio",
    name: "OBS Studio",
    publisher: "OBS Project",
    summary: "Free software for video recording and live streaming.",
    description:
      "OBS Studio brings your camera, microphone, windows and desktop together into scenes you can record or stream live.\n\nBuild layouts from any number of sources, switch between them with custom transitions, and mix audio with per-source filters such as noise suppression and gain. Stream to Twitch, YouTube and other services, or record locally in high quality.",
    categories: ["Creativity", "Entertainment"],
    license: "GPL-2.0",
    websiteUrl: "https://obsproject.com",
    iconUrl: `${raw}/obsproject/obs-studio/master/frontend/cmake/linux/icons/obs-logo-256.png`,
    screenshots: [
      { url: "https://obsproject.com/assets/images/features-new/hero_32_1_1.png", alt: "OBS Studio main window with a scene preview, sources and audio mixer" },
      { url: "https://obsproject.com/assets/images/features-new/scenes.png", alt: "OBS Studio scene and source management" },
    ],
    featured: true,
  },
  {
    repo: "LibreOffice/core",
    name: "LibreOffice",
    publisher: "The Document Foundation",
    summary: "A full office suite: documents, spreadsheets, presentations and more.",
    description:
      "LibreOffice includes Writer for documents, Calc for spreadsheets, Impress for presentations, Draw for diagrams, Base for databases and Math for formulas.\n\nIt opens and saves Microsoft Office formats and uses the OpenDocument standard natively, so your files stay yours.",
    categories: ["Productivity"],
    license: "MPL-2.0",
    websiteUrl: "https://www.libreoffice.org/download/download-libreoffice/",
    iconUrl: `${raw}/LibreOffice/core/master/sysui/desktop/icons/hicolor/256x256/apps/main.png`,
    screenshots: [
      { url: "https://www.libreoffice.org/media/screenshot_writer.png", alt: "LibreOffice Writer editing a document" },
      { url: "https://www.libreoffice.org/media/screenshot_calc.png", alt: "LibreOffice Calc with a spreadsheet and chart" },
    ],
    featured: true,
  },
  {
    repo: "videolan/vlc",
    name: "VLC media player",
    publisher: "VideoLAN",
    summary: "Plays almost any video or audio file, disc or network stream.",
    description:
      "VLC is a simple, fast media player that handles nearly every format without extra codec packs. Play local files, DVDs, audio CDs and network streams, add subtitles, adjust audio and video, and convert between formats.",
    categories: ["Entertainment"],
    license: "GPL-2.0",
    websiteUrl: "https://www.videolan.org/vlc/",
    iconUrl: `${raw}/videolan/vlc/master/share/icons/256x256/vlc.png`,
    featured: true,
  },
  {
    repo: "blender/blender",
    name: "Blender",
    publisher: "Blender Foundation",
    summary: "The complete 3D creation suite: modeling, animation, rendering and more.",
    description:
      "Blender covers the entire 3D pipeline: modeling, sculpting, rigging, animation, simulation, rendering, compositing and motion tracking, plus video editing and 2D animation with Grease Pencil.",
    categories: ["Creativity"],
    license: "GPL-3.0",
    websiteUrl: "https://www.blender.org/download/",
    iconUrl: `${raw}/blender/blender/main/release/freedesktop/icons/scalable/apps/blender.svg`,
    featured: true,
  },
  {
    repo: "audacity/audacity",
    name: "Audacity",
    publisher: "Audacity Team",
    summary: "Record, edit and mix audio with an easy multi-track editor.",
    description:
      "Audacity is a multi-track audio editor and recorder. Record from a microphone or mixer, cut and arrange clips, apply effects such as noise reduction and equalization, and export to common audio formats.",
    categories: ["Creativity"],
    license: "GPL-3.0",
    websiteUrl: "https://www.audacityteam.org",
    iconUrl: `${raw}/audacity/audacity/master/share/icons/AppIcon/AU4_AppIcon_256x256.png`,
  },
  {
    repo: "godotengine/godot",
    name: "Godot Engine",
    publisher: "Godot Engine",
    summary: "A feature-packed engine for building 2D and 3D games.",
    description:
      "Godot provides a full set of tools for making 2D and 3D games in a single editor, with its own scripting language GDScript as well as C# support. Export your game to desktop, mobile and the web.",
    categories: ["Developer Tools", "Creativity"],
    license: "MIT",
    websiteUrl: "https://godotengine.org/download/",
    iconUrl: `${raw}/godotengine/godot/master/misc/logo/icon.png`,
    screenshots: [
      { url: `${raw}/godotengine/godot-design/master/screenshots/editor_tps_demo_1920x1080.jpg`, alt: "Godot editor showing a 3D third-person demo scene" },
    ],
  },
  {
    repo: "keepassxreboot/keepassxc",
    name: "KeePassXC",
    publisher: "KeePassXC Team",
    summary: "An offline password manager that keeps your vault on your device.",
    description:
      "KeePassXC stores your passwords in an encrypted database file that you control. Generate strong passwords, autofill logins with the browser extension, store TOTP codes and SSH keys, and sync the file however you like.",
    categories: ["Security & Privacy"],
    license: "GPL-3.0",
    websiteUrl: "https://keepassxc.org",
    iconUrl: `${raw}/keepassxreboot/keepassxc/develop/share/branding/png/keepassxc-256x256.png`,
  },
  {
    repo: "HandBrake/HandBrake",
    name: "HandBrake",
    publisher: "The HandBrake Team",
    summary: "Convert video from nearly any format to modern codecs.",
    description:
      "HandBrake converts video files and unprotected discs to MP4, MKV and WebM using modern codecs. Built-in presets for devices make it easy, while advanced options cover filters, subtitles, chapters and audio tracks.",
    categories: ["Utilities", "Creativity"],
    license: "GPL-2.0",
    websiteUrl: "https://handbrake.fr",
    iconUrl: `${raw}/HandBrake/HandBrake/master/gtk/icons/256x256/apps/fr.handbrake.ghb.png`,
  },
  {
    repo: "laurent22/joplin",
    name: "Joplin",
    publisher: "Joplin",
    summary: "Private, Markdown-based notes and to-dos that sync everywhere.",
    description:
      "Joplin organizes notes and to-do lists into notebooks, written in Markdown. Sync through Joplin Cloud, Nextcloud, Dropbox or OneDrive with optional end-to-end encryption, and clip web pages with the browser extension.",
    categories: ["Productivity"],
    license: "AGPL-3.0",
    websiteUrl: "https://joplinapp.org",
    iconUrl: `${raw}/laurent22/joplin/dev/Assets/LinuxIcons/256x256.png`,
    screenshots: [
      { url: `${raw}/laurent22/joplin/dev/Assets/WebsiteAssets/images/home-top-img.png`, alt: "Joplin on desktop and mobile showing a notebook of notes" },
    ],
  },
  {
    repo: "mltframework/shotcut",
    name: "Shotcut",
    publisher: "Meltytech",
    summary: "A cross-platform video editor with a wide range of formats.",
    description:
      "Shotcut is a non-linear video editor with native timeline editing, no import required. It supports hundreds of audio and video formats, 4K resolution, and a large library of video and audio filters.",
    categories: ["Creativity"],
    license: "GPL-3.0",
    websiteUrl: "https://www.shotcut.org",
    iconUrl: `${raw}/mltframework/shotcut/master/icons/shotcut-logo-320x320.png`,
    screenshots: [
      { url: "https://www.shotcut.org/assets/img/screenshots/Shotcut-18.11.18.png", alt: "Shotcut editing timeline with filters and preview" },
    ],
  },
  {
    repo: "localsend/localsend",
    name: "LocalSend",
    publisher: "LocalSend",
    summary: "Share files with nearby devices over your local network.",
    description:
      "LocalSend sends files and messages between nearby devices without an internet connection or an account. Transfers stay on your local network and are encrypted end to end.",
    categories: ["Utilities", "Communication"],
    license: "Apache-2.0",
    websiteUrl: "https://localsend.org",
    iconUrl: `${raw}/localsend/localsend/main/app/assets/img/logo-256.png`,
    screenshots: [
      { url: "https://localsend.org/img/screenshot-pc.webp", alt: "LocalSend desktop window listing nearby devices" },
    ],
  },
  {
    repo: "bitwarden/clients",
    name: "Bitwarden",
    publisher: "Bitwarden",
    summary: "An open-source password manager for all your devices.",
    description:
      "Keep your logins, cards and notes in an encrypted vault that syncs across your devices. Generate strong passwords and share securely. The personal free plan covers essential password management; optional paid plans are available.",
    categories: ["Security & Privacy"],
    license: "GPL-3.0",
    websiteUrl: "https://bitwarden.com/download/",
    iconUrl: `${raw}/bitwarden/clients/main/apps/desktop/resources/icons/256x256.png`,
    tagPrefix: "desktop-",
  },
  {
    repo: "logseq/logseq",
    name: "Logseq",
    publisher: "Logseq",
    summary: "A privacy-first outliner for building your knowledge graph.",
    description:
      "Logseq is a local-first outliner for notes, journals and tasks. Link ideas with bidirectional references, query your graph, and keep everything in plain files you own.",
    categories: ["Productivity", "Education"],
    license: "AGPL-3.0",
    websiteUrl: "https://logseq.com",
    iconUrl: `${raw}/logseq/logseq/master/assets/icon.png`,
    screenshots: [
      { url: "https://user-images.githubusercontent.com/25513724/220608753-f33db466-af72-4611-b603-411440c15ed0.png", alt: "Logseq journal page with linked references" },
    ],
  },
  {
    repo: "flameshot-org/flameshot",
    name: "Flameshot",
    publisher: "Flameshot",
    summary: "Powerful yet simple screenshot and annotation tool.",
    description:
      "Capture any part of your screen and annotate it in place with arrows, text, blur, highlights and numbered markers. Copy, save or upload the result, all from a keyboard shortcut.",
    categories: ["Utilities"],
    license: "GPL-3.0",
    websiteUrl: "https://flameshot.org",
    iconUrl: `${raw}/flameshot-org/flameshot/master/data/img/app/org.flameshot.Flameshot.svg`,
  },
  {
    repo: "musescore/MuseScore",
    name: "MuseScore Studio",
    publisher: "MuseScore",
    summary: "Create, play back and print beautiful sheet music.",
    description:
      "MuseScore Studio is a music notation editor. Enter notes with a keyboard, mouse or MIDI device, hear your score with realistic playback, and export to PDF, MusicXML, MIDI and audio.",
    categories: ["Creativity", "Education"],
    license: "GPL-3.0",
    websiteUrl: "https://musescore.org",
    iconUrl: `${raw}/musescore/MuseScore/main/share/icons/AppIcon/MS4_AppIcon_256x256.png`,
  },
  {
    repo: "qbittorrent/qBittorrent",
    name: "qBittorrent",
    publisher: "The qBittorrent Project",
    summary: "A lightweight, ad-free BitTorrent client.",
    description:
      "qBittorrent is a BitTorrent client with an integrated search engine, RSS downloader, sequential downloads, bandwidth scheduling and a web interface for remote control. No ads, no bundled software.",
    categories: ["Utilities"],
    license: "GPL-2.0",
    websiteUrl: "https://www.qbittorrent.org/download",
    iconUrl: `${raw}/qbittorrent/qBittorrent/master/dist/unix/menuicons/192x192/apps/qbittorrent.png`,
  },
  {
    repo: "mozilla-firefox/firefox",
    name: "Firefox",
    publisher: "Mozilla",
    summary: "A fast, private browser from a non-profit.",
    description:
      "Firefox blocks trackers by default, keeps your tabs organized and syncs bookmarks and passwords across your devices. Make it yours with thousands of extensions.",
    categories: ["Utilities", "Security & Privacy"],
    license: "MPL-2.0",
    websiteUrl: "https://www.firefox.com/",
    iconUrl: `${raw}/mozilla-firefox/firefox/main/browser/branding/official/default256.png`,
  },
  {
    repo: "KDE/krita",
    name: "Krita",
    publisher: "KDE",
    summary: "Professional digital painting, made by artists.",
    description:
      "Krita is a painting program for concept art, illustration, comics and textures. It offers customizable brushes, layers, a brush stabilizer, wrap-around mode, and frame-by-frame animation.",
    categories: ["Creativity"],
    license: "GPL-3.0",
    websiteUrl: "https://krita.org/en/download/",
    iconUrl: `${raw}/KDE/krita/master/krita/pics/branding/default/256-apps-krita.png`,
  },
  {
    repo: "GNOME/gimp",
    name: "GIMP",
    publisher: "The GIMP Team",
    summary: "The GNU Image Manipulation Program for photo editing and design.",
    description:
      "GIMP is a raster graphics editor for photo retouching, image composition and creating artwork. Use layers, masks, selections and a large set of filters, and extend it with scripts and plug-ins.",
    categories: ["Creativity"],
    license: "GPL-3.0",
    websiteUrl: "https://www.gimp.org/downloads/",
    iconUrl: `${raw}/GNOME/gimp/master/docs/Wilber.svg`,
  },
];

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

async function github<T>(path: string): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com${path}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`GitHub ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

interface GitHubRepo {
  id: number;
  html_url: string;
  owner: { login: string; avatar_url: string };
  name: string;
}
interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{
    id: number;
    name: string;
    size: number;
    state: string;
    content_type: string;
    browser_download_url: string;
  }>;
}

async function latestRelease(repo: string, tagPrefix?: string) {
  if (!tagPrefix)
    return github<GitHubRelease>(`/repos/${repo}/releases/latest`);
  const releases = await github<GitHubRelease[]>(
    `/repos/${repo}/releases?per_page=30`,
  );
  return (
    releases?.find(
      (r) => !r.draft && !r.prerelease && r.tag_name.startsWith(tagPrefix),
    ) ?? null
  );
}

// Variants a typical user should not be offered: command-line builds, portable
// or legacy editions, unsigned/commercial duplicates, alternate lib versions.
const skipVariant =
  /cli|commercial|unsigned|portable|legacy|lt20|\.paf\.|debug|symbols/i;
const formatPreference = ["exe", "msi", "dmg", "pkg", "appimage", "deb", "rpm"];

// One installer per platform and architecture, as a publisher would select.
function pickInstallers(release: GitHubRelease) {
  const version = release.tag_name.replace(/^\D*/, "");
  let candidates = release.assets
    .filter((asset) => !skipVariant.test(asset.name))
    .map((asset) => {
      const info = classifyAsset(asset, release.id);
      const name = asset.name.toLowerCase();
      // Project naming that the generic classifier does not recognize.
      if (/apple|arm-64|win_arm/.test(name)) info.architecture = "arm64";
      else if (/intel|x86-64/.test(name) && info.architecture !== "arm64")
        info.architecture = "x64";
      return { asset, info };
    })
    .filter(({ info }) => info.eligible);
  // Some releases also carry newer hotfix files; per platform, keep the tagged
  // version's when any file names it.
  candidates = candidates.filter(
    ({ asset, info }) =>
      asset.name.includes(version) ||
      !candidates.some(
        (other) =>
          other.info.platform === info.platform &&
          other.asset.name.includes(version),
      ),
  );
  const best = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const key = `${candidate.info.platform}:${candidate.info.architecture}`;
    const current = best.get(key);
    if (
      !current ||
      formatPreference.indexOf(candidate.info.format) <
        formatPreference.indexOf(current.info.format)
    )
      best.set(key, candidate);
  }
  // A universal macOS build covers both processors.
  const picked = [...best.values()];
  return picked.some(
    ({ info }) => info.platform === "macos" && info.architecture === "universal",
  )
    ? picked.filter(
        ({ info }) =>
          info.platform !== "macos" || info.architecture === "universal",
      )
    : picked;
}

const check = <T>(result: { data: T; error: unknown }): T => {
  if (result.error) throw result.error;
  return result.data;
};

async function ensurePublisher(owner: GitHubRepo["owner"], name: string) {
  const existing = check(
    await db
      .from("developer_profiles")
      .select("user_id")
      .ilike("github_username", owner.login)
      .maybeSingle(),
  );
  if (existing) return existing.user_id as string;
  // Placeholder publisher accounts: no password, cannot sign in.
  const { data, error } = await db.auth.admin.createUser({
    email: `seed+${owner.login.toLowerCase()}@commons.invalid`,
    email_confirm: true,
    user_metadata: { seed: true, user_name: owner.login },
  });
  if (error) throw error;
  check(
    await db.from("developer_profiles").insert({
      user_id: data.user.id,
      github_username: owner.login,
      display_name: name,
      avatar_url: owner.avatar_url,
    }),
  );
  return data.user.id;
}

const categoryIds = new Map(
  (check(await db.from("categories").select("id, name")) ?? []).map(
    (c: { id: string; name: string }) => [c.name, c.id],
  ),
);

const now = Date.now();
for (const [index, app] of apps.entries()) {
  const repo = await github<GitHubRepo>(`/repos/${app.repo}`);
  if (!repo) {
    console.warn(`skip ${app.repo}: repository not found`);
    continue;
  }
  const publisherId = await ensurePublisher(repo.owner, app.publisher);
  const slug = app.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const release = await latestRelease(app.repo, app.tagPrefix);
  const assets = release ? pickInstallers(release) : [];

  // The privileged-fields trigger rejects updates to status/featured from the
  // API, so a re-run replaces the listing (child rows cascade).
  check(
    await db.from("applications").delete().eq("github_repository_id", repo.id),
  );
  const row = check(
    await db
      .from("applications")
      .insert(
        {
          publisher_id: publisherId,
          name: app.name,
          slug,
          summary: app.summary,
          description: app.description,
          icon_url: app.iconUrl,
          repository_url: `https://github.com/${app.repo}`,
          repository_owner: app.repo.split("/")[0],
          repository_name: app.repo.split("/")[1],
          github_repository_id: repo.id,
          license: app.license,
          website_url: app.websiteUrl,
          status: "published",
          featured: app.featured ?? false,
          // Stagger so the default (newest first) order follows this list.
          published_at: new Date(now - index * 60_000).toISOString(),
        },
      )
      .select("id")
      .single(),
  ) as { id: string };

  check(
    await db.from("application_categories").insert(
      app.categories.map((name) => {
        const id = categoryIds.get(name);
        if (!id) throw new Error(`Unknown category ${name}`);
        return { application_id: row.id, category_id: id };
      }),
    ),
  );
  if (app.screenshots?.length)
    check(
      await db.from("application_screenshots").insert(
        app.screenshots.map((s, order) => ({
          application_id: row.id,
          image_url: s.url,
          alt_text: s.alt,
          display_order: order,
        })),
      ),
    );
  if (release) {
    const version = check(
      await db
        .from("application_versions")
        .insert({
          application_id: row.id,
          version: release.tag_name.replace(
            /^(desktop-|release-|audacity-)?v?/i,
            "",
          ),
          git_tag: release.tag_name,
          release_name: release.name,
          release_notes: (release.body ?? "").slice(0, 10000),
          github_release_url: release.html_url,
          released_at: release.published_at,
          prerelease: release.prerelease,
          github_release_id: release.id,
        })
        .select("id")
        .single(),
    ) as { id: string };
    if (assets.length)
      check(
        await db.from("release_assets").insert(
          assets.map(({ asset, info }) => ({
            version_id: version.id,
            github_asset_id: asset.id,
            file_name: asset.name,
            download_url: asset.browser_download_url,
            mime_type: asset.content_type,
            file_size_bytes: asset.size,
            platform: info.platform!,
            architecture: info.architecture,
            kind: "installer",
          })),
        ),
      );
  }
  console.log(
    `✓ ${app.name.padEnd(18)} ${release ? `${release.tag_name} (${assets.length} installers)` : "no GitHub release; website download"}`,
  );
}
