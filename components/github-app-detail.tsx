"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Heart } from "lucide-react";
import type {
  ReleaseAsset,
  RepositoryImport,
} from "@/lib/publishing/types";
import type { MarketplaceApp, Platform } from "@/lib/types";
import {
  AppIcon,
  PlatformBadge,
} from "@/components/marketplace";
import {
  DownloadButton,
  FeatureList,
  ScreenshotGallery,
} from "@/components/app-details";

type ImportState =
  | { repository: null; error: null }
  | { repository: RepositoryImport; error: null }
  | { repository: null; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpsGithubUrl(value: unknown, pathname?: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (!pathname || url.pathname.toLowerCase() === pathname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function isGithubAvatarUrl(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "avatars.githubusercontent.com" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isRepositoryImport(
  value: unknown,
  expectedFullName: string,
): value is RepositoryImport {
  return (
    isRecord(value) &&
    typeof value.fullName === "string" &&
    value.fullName.toLowerCase() === expectedFullName.toLowerCase() &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    isHttpsGithubUrl(value.url, `/${expectedFullName}`) &&
    typeof value.websiteUrl === "string" &&
    typeof value.owner === "string" &&
    isGithubAvatarUrl(value.avatarUrl) &&
    (typeof value.license === "string" || value.license === null) &&
    typeof value.readme === "string" &&
    Array.isArray(value.releases) &&
    value.releases.every(
      (release) =>
        isRecord(release) &&
        typeof release.id === "number" &&
        typeof release.version === "string" &&
        (typeof release.publishedAt === "string" ||
          release.publishedAt === null) &&
        typeof release.notes === "string" &&
        typeof release.url === "string" &&
        Array.isArray(release.assets) &&
        release.assets.every(
          (asset) =>
            isRecord(asset) &&
            typeof asset.id === "number" &&
            typeof asset.name === "string" &&
            typeof asset.size === "number" &&
            typeof asset.url === "string" &&
            (typeof asset.platform === "string" ||
              asset.platform === null) &&
            typeof asset.eligible === "boolean",
        ),
    )
  );
}

function marketplaceApp(repository: RepositoryImport): MarketplaceApp {
  const latestRelease = repository.releases[0];
  const platforms = [...new Set(
    repository.releases.flatMap((release) =>
      release.assets
        .filter(isEligibleDesktopAsset)
        .map((asset) => asset.platform),
    ),
  )];

  return {
    id: `github:${repository.fullName}`,
    slug: repository.fullName,
    name: repository.name,
    summary: repository.description || "Public GitHub repository",
    description:
      repository.description ||
      repository.readme.slice(0, 6000) ||
      "Public GitHub repository",
    iconUrl: repository.avatarUrl || null,
    screenshots: [],
    category: "GitHub",
    developerName: repository.owner,
    repositoryUrl: repository.url,
    websiteUrl: repository.websiteUrl,
    license: repository.license,
    latestVersion: latestRelease?.version ?? null,
    updatedAt: latestRelease?.publishedAt ?? null,
    platforms,
    color: "#eaf1ff",
    features: [],
    releasesUrl: `${repository.url}/releases`,
    release: latestRelease
      ? {
          version: latestRelease.version,
          publishedAt: latestRelease.publishedAt ?? undefined,
          notes: latestRelease.notes,
          releasesUrl: latestRelease.url,
        }
      : undefined,
  };
}

function isDesktopPlatform(
  platform: string | null,
): platform is Exclude<Platform, "web"> {
  return platform === "windows" || platform === "macos" || platform === "linux";
}

function isEligibleDesktopAsset(
  asset: ReleaseAsset,
): asset is ReleaseAsset & { platform: Exclude<Platform, "web"> } {
  return asset.eligible && isDesktopPlatform(asset.platform);
}

export function PublicGithubAppDetail({
  repository: fullName,
}: {
  repository: string;
}) {
  const [state, setState] = useState<ImportState>({
    repository: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ repository: fullName });
    const timer = window.setTimeout(() => {
      void fetch(`/api/developer/import?${params}`, {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(45000),
        ]),
      })
        .then(async (response) => {
          const payload: unknown = await response.json();
          if (!response.ok) {
            const message =
              isRecord(payload) && typeof payload.error === "string"
                ? payload.error
                : "Could not load this public GitHub repository.";
            throw new Error(message);
          }
          if (!isRepositoryImport(payload, fullName)) {
            throw new Error(
              "GitHub returned repository details in an unexpected format.",
            );
          }
          return payload;
        })
        .then((repository) => setState({ repository, error: null }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            repository: null,
            error:
              error instanceof Error
                ? error.message
                : "Could not load this public GitHub repository.",
          });
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fullName]);

  const app = state.repository ? marketplaceApp(state.repository) : null;

  return (
    <main id="main" className="page-container inner-page">
      <Link href="/apps" className="back-link">
        <ArrowLeft size={16} />
        Search results
      </Link>
      <p className="sample-label">
        GitHub repository preview · Public project, not a reviewed Commons listing
      </p>
      {!app ? (
        state.error ? (
          <section className="github-detail-error" role="alert">
            <h1>Repository details aren’t available.</h1>
            <p>{state.error}</p>
            <a href={`https://github.com/${fullName}`} target="_blank" rel="noreferrer">
              View repository on GitHub <ArrowUpRight size={14} />
            </a>
          </section>
        ) : (
          <p role="status">Loading public repository details…</p>
        )
      ) : (
        <>
          <div className="detail-header">
            <AppIcon app={app} large />
            <div>
              <h1>{app.name}</h1>
              <p>{app.summary}</p>
              <span className="byline">By {app.developerName}</span>
              <span className="detail-category">GitHub</span>
              {app.platforms.length > 0 ? (
                <PlatformBadge app={app} />
              ) : (
                <span className="platforms">
                  No supported installer found in stable releases
                </span>
              )}
              <a
                className="source-link"
                href={app.repositoryUrl}
                target="_blank"
                rel="noreferrer"
              >
                View source code <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
          <div className="detail-layout">
            <div>
              <ScreenshotGallery app={app} />
              <section className="detail-section">
                <h2>A little about {app.name}.</h2>
                <p>{app.description}</p>
                <FeatureList features={app.features} />
              </section>
              <section className="detail-section">
                <h2>The details</h2>
                <dl className="info-grid">
                  <div>
                    <dt>Made by</dt>
                    <dd>{app.developerName}</dd>
                  </div>
                  <div>
                    <dt>Available on</dt>
                    <dd>
                      {app.platforms.length > 0 ? (
                        <PlatformBadge app={app} />
                      ) : (
                        "No supported installers found"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>License</dt>
                    <dd>{app.license ?? "No license specified"}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{app.latestVersion ?? "No stable release found"}</dd>
                  </div>
                </dl>
              </section>
            </div>
            <aside>
              {app.platforms.length > 0 ? (
                <DownloadButton
                  app={app}
                  endpoint={`/api/developer/repository-download?repository=${encodeURIComponent(
                    fullName,
                  )}`}
                />
              ) : (
                <section className="download-panel" aria-label="Get this application">
                  <h2>Get the app</h2>
                  <p>
                    No supported installer was found in the stable public
                    releases.
                  </p>
                  <a
                    className="github-release-link"
                    href={app.releasesUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check official releases <ArrowUpRight size={14} />
                  </a>
                </section>
              )}
              <div className="community-note">
                <Heart size={20} />
                <h3>Made by people who care.</h3>
                <p>
                  Open-source software is built in the open. Explore it, share
                  it, and support the people behind it.
                </p>
              </div>
            </aside>
          </div>
          <section className="detail-section">
            <h2>What’s new</h2>
            {app.release?.notes ? (
              <p className="release-notes">{app.release.notes}</p>
            ) : (
              <p>
                Release notes haven’t been added to this repository. Visit the
                developer for more information.
              </p>
            )}
            <a
              href={app.releasesUrl}
              target="_blank"
              rel="noreferrer"
            >
              View official releases <ArrowUpRight size={14} />
            </a>
          </section>
        </>
      )}
    </main>
  );
}
