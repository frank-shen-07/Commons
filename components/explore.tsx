"use client";
import { useState } from "react";
import { Search, X, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { AppGrid, EmptyState } from "./marketplace";
import { GithubRepositoryResults } from "./github-repositories";
import { platforms, platformLabels, type MarketplaceApp } from "@/lib/types";
export function Explore({
  apps,
  categories,
  initialQuery,
  initialCategory,
}: {
  apps: MarketplaceApp[];
  categories: string[];
  initialQuery: string;
  initialCategory: string;
}) {
  const [query, setQuery] = useState(initialQuery),
    [category, setCategory] = useState(initialCategory),
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
  const reset = () => {
    setQuery("");
    setCategory("");
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
        <button className="reset-button" onClick={reset}>
          Reset filters
          <X size={12} />
        </button>
      </div>
      <section className={`results results-${view}`}>
        <div className="results-heading">
          <p role="status">
            {results.length} {results.length === 1 ? "app" : "apps"}
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
            <div className="view-toggle" aria-label="Result layout">
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
        ) : (
          <EmptyState reset={reset} searchQuery={query.trim()} />
        )}
      </section>
      <GithubRepositoryResults query={query} />
    </div>
  );
}
