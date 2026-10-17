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
  return (
    <main id="main" className="page-container discover-page">
      <div className="page-heading">
        <div>
          <h1>Discover something brilliant.</h1>
          <p>Independent apps. Everyday possibilities.</p>
        </div>
        <span className="open-source-note">
          <span />
          Open source. Open to everyone.
        </span>
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
      <section className="discovery-section">
        <SectionHeading
          title="Your everyday, upgraded"
          description="Thoughtful tools to make a little more of your day."
          href="/apps"
        />
        <AppGrid apps={apps.slice(0, 6)} variant="compact" />
      </section>
      <section className="discovery-section">
        <SectionHeading
          title="New & noteworthy"
          description={
            usingFixtures
              ? "A sample editorial selection, not a live release feed."
              : "A few more apps worth getting to know."
          }
          href="/apps"
        />
        <div className="noteworthy-grid">
          {withScreenshots.slice(0, 2).map((app) => (
            <AppGrid apps={[app]} key={app.id} variant="preview" />
          ))}
          {withScreenshots.length === 0 && <AppGrid apps={apps.slice(0, 3)} />}
        </div>
      </section>
      <section className="discovery-section">
        <SectionHeading
          title="Good things come together"
          description="A starting point for whatever you’re working on."
        />
        <div className="collection-grid">
          <Link
            href="/apps?category=Creativity"
            className="collection collection-creative"
          >
            <Palette size={27} />
            <div>
              <h3>The creative toolkit</h3>
              <p>Less friction. More imagination.</p>
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
              <p>Put your digital life in your hands.</p>
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
              <p>Small tools for meaningful work.</p>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="discovery-section" id="categories">
        <SectionHeading
          title="Find your corner"
          href="/apps"
          link="Browse all apps"
        />
        <div className="category-grid">
          {categories.map((name) => (
            <CategoryCard key={name} name={name} />
          ))}
        </div>
      </section>
      <section className="developer-banner">
        <Code2 size={27} />
        <div>
          <h2>Your next users are out there.</h2>
          <p>Help them discover what you’ve been building.</p>
        </div>
        <Link href="/about#developers">
          Publish your app
          <ArrowRight size={15} />
        </Link>
      </section>
      <div className="last-line">
        <p>Made by communities. Discovered by you.</p>
      </div>
    </main>
  );
}
