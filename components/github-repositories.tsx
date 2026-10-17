"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppGrid } from "./marketplace";
import type { MarketplaceApp } from "@/lib/types";
import {
  searchPublicGithubRepositories,
  type PublicGithubRepository,
} from "@/lib/github-search";

type SearchState = {
  query: string;
  status: "idle" | "loading" | "success" | "error";
  repositories: PublicGithubRepository[];
  error?: string;
};

function repositoryApp(
  repository: PublicGithubRepository,
): MarketplaceApp {
  const [owner, name] = repository.fullName.split("/");
  const description = repository.description?.trim();
  return {
    id: `github:${repository.fullName}`,
    slug: repository.fullName,
    name,
    summary: description || "Public GitHub repository",
    description: description || "Public GitHub repository",
    iconUrl: repository.avatarUrl,
    screenshots: [],
    category: "GitHub",
    developerName: owner,
    repositoryUrl: `https://github.com/${repository.fullName}`,
    websiteUrl: "",
    license: null,
    latestVersion: null,
    updatedAt: null,
    platforms: [],
    repositoryStars: repository.stars,
    color: "#eaf1ff",
    features: [],
  };
}

function searchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.name === "TimeoutError")
      return "GitHub search took too long. Try again.";
    if (error.name !== "TypeError") return error.message;
  }
  return "Could not reach GitHub. Check your connection and try again.";
}

export function GithubRepositoryResults({ query }: { query: string }) {
  const normalizedQuery = query.trim();
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState<SearchState>({
    query: "",
    status: "idle",
    repositories: [],
  });

  useEffect(() => {
    const currentQuery = normalizedQuery;
    if (currentQuery.length < 3) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearch({
        query: currentQuery,
        status: "loading",
        repositories: [],
      });
      void searchPublicGithubRepositories(currentQuery, controller.signal)
        .then((repositories) => {
          setSearch({ query: currentQuery, status: "success", repositories });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setSearch({
            query: currentQuery,
            status: "error",
            repositories: [],
            error: searchErrorMessage(error),
          });
        });
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, retryCount]);

  if (!normalizedQuery) return null;

  const currentSearch: SearchState =
    search.query === normalizedQuery
      ? search
      : {
          query: normalizedQuery,
          status: normalizedQuery.length < 3 ? "idle" : "loading",
          repositories: [],
        };

  return (
    <section className="github-results" aria-labelledby="github-results-title">
      <div className="github-results-heading">
        <h2 id="github-results-title">Public repositories on GitHub</h2>
        <p>Public GitHub projects, ranked by stars.</p>
      </div>
      {normalizedQuery.length < 3 ? (
        <p className="github-results-status" role="status">
          Enter at least 3 characters to search GitHub.
        </p>
      ) : currentSearch.status === "loading" ? (
        <p className="github-results-status" role="status">
          Searching GitHub…
        </p>
      ) : currentSearch.status === "error" ? (
        <div className="github-results-status github-results-error" role="alert">
          <p>{currentSearch.error}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      ) : currentSearch.status === "success" &&
        currentSearch.repositories.length === 0 ? (
        <p className="github-results-status" role="status">
          No public GitHub repositories found for “{normalizedQuery}”.
        </p>
      ) : currentSearch.status === "success" ? (
        <AppGrid
          apps={currentSearch.repositories.map(repositoryApp)}
          variant="compact"
          getHref={(app) =>
            `/apps/github/${app.slug
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`
          }
        />
      ) : null}
    </section>
  );
}
