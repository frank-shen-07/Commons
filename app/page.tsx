import Link from "next/link";
import {
  ArrowUpRight,
  Code2,
  Layers2,
  LockKeyhole,
  Palette,
  ArrowRight,
} from "lucide-react";
import {
  AppGrid,
  AppIcon,
  CategoryCard,
  FeaturedAppCard,
  SectionHeading,
} from "@/components/marketplace";
const collections = [
  {
    title: "The creative toolkit",
    category: "Creativity",
    tone: "creative",
    icon: Palette,
  },
  {
    title: "A little more private",
    category: "Security & Privacy",
    tone: "privacy",
    icon: LockKeyhole,
  },
  {
    title: "Make space for focus",
    category: "Productivity",
    tone: "work",
    icon: Layers2,
  },
];
import { getApps, getCategories, usingFixtures } from "@/lib/api";
export default async function Home() {
  const [apps, categories] = await Promise.all([getApps(), getCategories()]);
  const withScreenshots = apps.filter((app) => app.screenshots.length > 0);
  const featured = withScreenshots.length
    ? withScreenshots.slice(0, 2)
    : apps.filter((app) => app.featured).slice(0, 2);
  // Later sections skip apps already featured above.
  const featuredIds = new Set(featured.map((app) => app.id));
  // Newest listings first, so the heading says something true.
  const noteworthy = withScreenshots
    .filter((app) => !featuredIds.has(app.id))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 2);
  const shownIds = new Set([
    ...featuredIds,
    ...noteworthy.map((app) => app.id),
  ]);
  const everyday = apps.filter((app) => !shownIds.has(app.id)).slice(0, 6);
  return (
    <main id="main" className="page-container discover-page">
      <div className="page-heading">
        <div>
          <h1>Discover</h1>
          <p>Free and open-source apps for everyday life.</p>
        </div>
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
          {collections.map(({ title, category, tone, icon: Icon }) => {
            const members = apps.filter((app) => app.category === category);
            const names = members.slice(0, 3).map((app) => app.name);
            return (
              <Link
                key={category}
                href={`/apps?category=${encodeURIComponent(category)}`}
                className={`collection collection-${tone}`}
              >
                {members.length > 0 ? (
                  <span className="collection-apps" aria-hidden>
                    {members.slice(0, 4).map((app) => (
                      <AppIcon app={app} key={app.id} />
                    ))}
                  </span>
                ) : (
                  <Icon size={27} />
                )}
                <div>
                  <h3>{title}</h3>
                  {names.length > 0 && (
                    <p>
                      {names.join(", ")}
                      {members.length > names.length && " and more"}
                    </p>
                  )}
                </div>
                <ArrowUpRight size={17} />
              </Link>
            );
          })}
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
