import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Heart } from "lucide-react";
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
  const app = await getApp((await params).slug);
  if (!app) notFound();
  const catalog = await getApps();
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
                  <PlatformBadge app={app} />
                </dd>
              </div>
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
            <details>
              <summary>Source code & technical information</summary>
              <p>
                Explore the project, read its license, or contribute to its
                development.
              </p>
              <a href={app.repositoryUrl} target="_blank" rel="noreferrer">
                View source code <ArrowUpRight size={14} />
              </a>
            </details>
          </section>
        </div>
        <aside>
          <DownloadButton
            app={app}
            endpoint={process.env.DISTRIBUTION_DOWNLOAD_URL}
          />
          <div className="community-note">
            <Heart size={20} />
            <h3>Made by people who care.</h3>
            <p>
              Open-source software is built in the open. Explore it, share it,
              and support the people behind it.
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
            Release notes haven’t been added to this listing. Visit the
            developer for the latest changes.
          </p>
        )}
        {(app.releasesUrl || app.release?.releasesUrl) && (
          <a
            href={app.release?.releasesUrl ?? app.releasesUrl}
            target="_blank"
            rel="noreferrer"
          >
            View official releases <ArrowUpRight size={14} />
          </a>
        )}
      </section>
      {related.length > 0 && (
        <section className="discovery-section related-section">
          <SectionHeading title="More to explore" />
          <AppGrid apps={related} />
        </section>
      )}
    </main>
  );
}
