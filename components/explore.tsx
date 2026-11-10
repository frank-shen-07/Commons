"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { AppGrid, EmptyState } from "./marketplace";
import { GithubRepositoryResults } from "./github-repositories";
import { platforms, platformLabels, type MarketplaceApp } from "@/lib/types";
// Rewrites the address bar without a navigation, so a filtered view can be
// shared, reloaded, or returned to with the back button.
function writeFilters(query: string, category: string) {
  const next = new URLSearchParams();
  if (query) next.set("q", query);
  if (category) next.set("category", category);
  try {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${next.size ? `?${next}` : ""}`,
    );
  } catch {
    // Browsers limit how often history can change; the next edit catches up.
  }
}
export function Explore({
  apps,
  categories,
  initialQuery,
}: {
  apps: MarketplaceApp[];
  categories: string[];
  initialQuery: string;
}) {
  const params = useSearchParams();
  // The category lives in the address bar; the search field is local state
  // that is written there shortly after typing stops.
  const category = params.get("category") ?? "";
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery),
    [writtenQuery, setWrittenQuery] = useState(initialQuery),
    [seenQuery, setSeenQuery] = useState(urlQuery),
    [platform, setPlatform] = useState(""),
    [license, setLicense] = useState(""),
    [sort, setSort] = useState("featured"),
    [view, setView] = useState<"grid" | "list">("grid");
  const licenses = [
    ...new Set(
      apps
        .map((app) => app.license)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const results = apps
    .filter(
      (app) =>
        (!category || app.category === category) &&
        (!platform || app.platforms.some((p) => p === platform)) &&
        (!license || app.license === license) &&
        `${app.name} ${app.summary} ${app.description} ${app.category} ${app.developerName}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : Number(!!b.featured) - Number(!!a.featured),
    );
  // A navigation (the top-bar search, a sidebar link) changes the address
  // while this view stays mounted: adopt its search unless we wrote it.
  if (urlQuery !== seenQuery) {
    setSeenQuery(urlQuery);
    if (urlQuery !== writtenQuery) {
      setQuery(urlQuery);
      setWrittenQuery(urlQuery);
    }
  }
  const search = query.trim();
  useEffect(() => {
    if (search === urlQuery) return;
    const timer = window.setTimeout(() => {
      setWrittenQuery(search);
      writeFilters(search, category);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, urlQuery, category]);
  const setCategory = (next: string) => {
    setWrittenQuery(search);
    writeFilters(search, next);
  };
  const filtered = Boolean(
    query || category || platform || license || sort !== "featured",
  );
  const reset = () => {
    setQuery("");
    setWrittenQuery("");
    writeFilters("", "");
    setPlatform("");
    setLicense("");
    setSort("featured");
  };
  return (
    <div className="browse-interface">
      <div className="explore-search">
        <Search size={20} />
        <input
          aria-label="Search apps, categories, developers, or GitHub repositories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps, categories, developers, or GitHub repositories"
        />
        {query && (
          <button aria-label="Clear search" onClick={() => setQuery("")}>
            <X size={17} />
          </button>
        )}
      </div>
      <div
        className="category-filters"
        id="categories"
        role="group"
        aria-label="Category filters"
      >
        {["", ...categories].map((c) => (
          <button
            key={c}
            className={category === c ? "selected" : ""}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c || "All apps"}
          </button>
        ))}
      </div>
      <div className="filter-toolbar">
        <SlidersHorizontal size={16} />
        <label>
          <span className="sr-only">Your device</span>
          <select
            aria-label="Your device"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformLabels[p]}
              </option>
            ))}
          </select>
        </label>
        {licenses.length > 0 && (
          <label>
            <span className="sr-only">License</span>
            <select
              aria-label="License"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            >
              <option value="">All licenses</option>
              {licenses.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        {filtered && (
          <button className="reset-button" onClick={reset}>
            Reset filters
            <X size={12} />
          </button>
        )}
      </div>
      <section className={`results results-${view}`}>
        <div className="results-heading">
          <p role="status">
            {results.length} {results.length === 1 ? "app" : "apps"}
            {category && ` in ${category}`}
          </p>
          <div className="result-controls">
            <label>
              Sort by{" "}
              <select
                aria-label="Sort apps"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="featured">Featured first</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
            <div
              className="view-toggle"
              role="group"
              aria-label="Result layout"
            >
              <button
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
        {results.length ? (
          <AppGrid
            apps={results}
            variant={view === "list" ? "compact" : "standard"}
          />
        ) : query.trim() ? null /* GitHub results below cover searches */ : (
          <EmptyState
            reset={filtered ? reset : undefined}
            category={category}
            narrowed={Boolean(platform || license)}
          />
        )}
      </section>
      <GithubRepositoryResults query={query} />
    </div>
  );
}
