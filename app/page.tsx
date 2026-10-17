import Link from "next/link";
import {
  ArrowUpRight,
  Code2,
  LockKeyhole,
  Palette,
  ArrowRight,
} from "lucide-react";
import {
  AppGrid,
  CategoryCard,
  FeaturedAppCard,
  SectionHeading,
} from "@/components/marketplace";
import { getApps, getCategories, usingFixtures } from "@/lib/api";
export default async function Home() {
  const [apps, categories] = await Promise.all([getApps(), getCategories()]);
  const withScreenshots = apps.filter((app) => app.screenshots.length > 0);
  const featured = withScreenshots.length
    ? withScreenshots.slice(0, 2)
    : apps.filter((app) => app.featured).slice(0, 2);
  // Later sections skip apps already featured above.
  const featuredIds = new Set(featured.map((app) => app.id));
  const everyday = apps.filter((app) => !featuredIds.has(app.id)).slice(0, 6);
  const noteworthy = withScreenshots
    .filter((app) => !featuredIds.has(app.id))
    .slice(0, 2);
  return (
    <main id="main" className="page-container discover-page">
      <div className="page-heading">
        <h1>Discover</h1>
      </div>
      {usingFixtures && (
        <p className="sample-label">
          Preview catalog · Real apps, sample listings
        </p>
      )}
      <section className="featured-grid" aria-label="Featured applications">
        {featured.map((app, index) => (
          <FeaturedAppCard app={app} key={app.id} secondary={index === 1} />
        ))}
      </section>
      <section className="discovery-section essentials-section">
        <SectionHeading title="Everyday essentials" href="/apps" />
        <AppGrid apps={everyday} variant="compact" />
      </section>
      {noteworthy.length > 0 && (
        <section className="discovery-section">
          <SectionHeading title="New & noteworthy" href="/apps" />
          <div className="noteworthy-grid">
            {noteworthy.map((app) => (
              <AppGrid apps={[app]} key={app.id} variant="preview" />
            ))}
          </div>
        </section>
      )}
      <section className="discovery-section">
        <SectionHeading title="Collections" />
        <div className="collection-grid">
          <Link
            href="/apps?category=Creativity"
            className="collection collection-creative"
          >
            <Palette size={27} />
            <div>
              <h3>The creative toolkit</h3>
            </div>
            <ArrowUpRight size={17} />
          </Link>
          <Link
            href="/apps?category=Security%20%26%20Privacy"
            className="collection collection-privacy"
          >
            <LockKeyhole size={27} />
            <div>
              <h3>A little more private</h3>
            </div>
            <ArrowUpRight size={17} />
          </Link>
          <Link
            href="/apps?category=Productivity"
            className="collection collection-work"
          >
            <Code2 size={27} />
            <div>
              <h3>Make space for focus</h3>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="discovery-section" id="categories">
        <SectionHeading title="Categories" href="/apps" link="Browse all" />
        <div className="category-grid">
          {categories.map((name) => (
            <CategoryCard key={name} name={name} />
          ))}
        </div>
      </section>
      <section className="developer-banner">
        <Code2 size={27} />
        <h2>Made something open source? Share it here.</h2>
        <Link href="/developer">
          Publish your app
          <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
