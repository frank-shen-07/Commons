import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getApp, getApps, usingFixtures } from "@/lib/api";
import {
  AppIcon,
  AppGrid,
  PlatformBadge,
  SectionHeading,
} from "@/components/marketplace";
import {
  DownloadButton,
  FeatureList,
  ReleaseNotes,
  ScreenshotGallery,
} from "@/components/app-details";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const app = await getApp((await params).slug);
  return { title: app?.name ?? "App not found" };
}
export default async function DetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // The catalog (for related apps) doesn't depend on the app, so fetch both
  // at once rather than one after the other.
  const [app, catalog] = await Promise.all([
    getApp((await params).slug),
    getApps(),
  ]);
  if (!app) notFound();
  const related = catalog
    .filter(
      (other) => other.slug !== app.slug && other.category === app.category,
    )
    .slice(0, 3);
  return (
    <main id="main" className="page-container inner-page">
      <Link href="/apps" className="back-link">
        <ArrowLeft size={16} />
        All apps
      </Link>
      {usingFixtures && (
        <p className="sample-label">
          Sample listing · Visit the developer for current release information
        </p>
      )}
      <div className="detail-header">
        <AppIcon app={app} large />
        <div>
          <h1>{app.name}</h1>
          <p>{app.summary}</p>
          <span className="byline">By {app.developerName}</span>
          <Link
            className="detail-category"
            href={`/apps?category=${encodeURIComponent(app.category)}`}
          >
            {app.category}
          </Link>
          <PlatformBadge app={app} />
          <a
            className="source-link"
            href={app.repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            Source code <ArrowUpRight size={13} />
          </a>
          {app.websiteUrl && (
            <a
              className="source-link"
              href={app.websiteUrl}
              target="_blank"
              rel="noreferrer"
            >
              Website <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </div>
      <div className="detail-layout">
        <div>
          <ScreenshotGallery app={app} />
          <section className="detail-section">
            <h2>About</h2>
            <p>{app.description}</p>
            <FeatureList features={app.features} />
          </section>
          <section className="detail-section">
            <h2>Information</h2>
            <dl className="info-grid">
              <div>
                <dt>Developer</dt>
                <dd>{app.developerName}</dd>
              </div>
              {app.platforms.length > 0 && (
                <div>
                  <dt>Available on</dt>
                  <dd>
                    <PlatformBadge app={app} />
                  </dd>
                </div>
              )}
              <div>
                <dt>License</dt>
                <dd>{app.license ?? "See developer website"}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{app.latestVersion ?? "See latest official release"}</dd>
              </div>
              {app.updatedAt && (
                <div>
                  <dt>Updated</dt>
                  <dd>
                    {new Date(app.updatedAt).toLocaleDateString("en-AU", {
                      timeZone: "Australia/Sydney",
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
        <aside>
          <DownloadButton
            app={app}
            endpoint={
              process.env.DISTRIBUTION_DOWNLOAD_URL ??
              (usingFixtures ? undefined : "/api/apps/{slug}/download")
            }
          />
        </aside>
      </div>
      <section className="detail-section">
        <h2>What’s new</h2>
        {app.release?.notes ? (
          <ReleaseNotes notes={app.release.notes} />
        ) : (
          <p>No release notes yet.</p>
        )}
        {(app.releasesUrl || app.release?.releasesUrl) && (
          <a
            href={app.release?.releasesUrl ?? app.releasesUrl}
            target="_blank"
            rel="noreferrer"
          >
            All releases <ArrowUpRight size={14} />
          </a>
        )}
      </section>
      {related.length > 0 && (
        <section className="discovery-section related-section">
          <SectionHeading title="You might also like" />
          <AppGrid apps={related} />
        </section>
      )}
    </main>
  );
}
