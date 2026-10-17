import { test } from "node:test";
import assert from "node:assert/strict";
import { searchPublicGithubRepositories } from "../lib/github-search.ts";

test("public GitHub search is constrained, star-sorted, and excludes private or archived repos", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (input, options) => {
    requestedUrl = new URL(input);
    assert.equal(options.cache, "no-store");
    return Response.json({
      items: [
        {
          full_name: "photo/less",
          description: null,
          stargazers_count: 3,
          language: null,
          html_url: "https://github.com/photo/less",
          owner: { avatar_url: "https://avatars.githubusercontent.com/u/1" },
          archived: false,
          private: false,
        },
        {
          full_name: "photo/more",
          description: "Photo editor",
          stargazers_count: 40,
          language: "TypeScript",
          html_url: "https://github.com/photo/more",
          owner: { avatar_url: "https://avatars.githubusercontent.com/u/2" },
          archived: false,
          private: false,
        },
        {
          full_name: "photo/archived",
          description: null,
          stargazers_count: 90,
          language: null,
          html_url: "https://github.com/photo/archived",
          owner: { avatar_url: "https://avatars.githubusercontent.com/u/3" },
          archived: true,
          private: false,
        },
        {
          full_name: "photo/private",
          description: null,
          stargazers_count: 100,
          language: null,
          html_url: "https://github.com/photo/private",
          owner: { avatar_url: "https://avatars.githubusercontent.com/u/4" },
          archived: false,
          private: true,
        },
      ],
    });
  };
  try {
    const repositories = await searchPublicGithubRepositories(
      "  photo craft ",
      new AbortController().signal,
    );
    assert.equal(requestedUrl.hostname, "api.github.com");
    assert.equal(requestedUrl.pathname, "/search/repositories");
    assert.equal(
      requestedUrl.searchParams.get("q"),
      "photo craft is:public archived:false",
    );
    assert.equal(requestedUrl.searchParams.get("sort"), "stars");
    assert.equal(requestedUrl.searchParams.get("order"), "desc");
    assert.equal(requestedUrl.searchParams.get("per_page"), "20");
    assert.deepEqual(
      repositories.map(({ fullName }) => fullName),
      ["photo/more", "photo/less"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public GitHub search surfaces rate limits and malformed responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(
      searchPublicGithubRepositories("photocraft", new AbortController().signal),
      /rate limited/,
    );

    globalThis.fetch = async () => Response.json({ items: [{ invalid: true }] });
    await assert.rejects(
      searchPublicGithubRepositories("photocraft", new AbortController().signal),
      /unexpected format/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
