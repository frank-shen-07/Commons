import { Explore } from "@/components/explore";
import { getApps, getCategories, usingFixtures } from "@/lib/api";
export const metadata = { title: "Browse apps" };
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const [apps, categories, params] = await Promise.all([
    getApps(),
    getCategories(),
    searchParams,
  ]);
  return (
    <main id="main" className="page-container inner-page">
      <h1>Find your next favorite app.</h1>
      <p className="page-description">
        Browse independent software for your work, ideas, and everyday life.
      </p>
      {usingFixtures && (
        <p className="sample-label">
          Preview catalog · Sample listings, no live marketplace activity
        </p>
      )}
      <Explore
        key={`${params.q ?? ""}:${params.category ?? ""}`}
        apps={apps}
        categories={categories}
        initialQuery={params.q ?? ""}
        initialCategory={params.category ?? ""}
      />
    </main>
  );
}
