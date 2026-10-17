import { test } from "node:test";
import assert from "node:assert/strict";
import {
  browseQuerySchema,
  listingSchema,
  publicationEligible,
  slugify,
  updateListingSchema,
} from "../lib/backend/validation.ts";
import { repositoryName } from "../lib/publishing/validation.ts";
import { isOfficialReleaseUrl } from "../lib/publishing/validation.ts";
import { classifyAsset } from "../lib/publishing/assets.ts";
import {
  requireAuthenticatedUser,
  requireGithubProviderToken,
  resolveOAuthCallback,
} from "../lib/backend/oauth-flow.ts";
import { logServerError } from "../lib/backend/errors.ts";

test("slug generation is stable and falls back for punctuation-only names", () => {
  assert.equal(slugify("Commons & Tools!"), "commons-tools");
  assert.equal(slugify("  "), "application");
});

test("browse input applies bounded pagination and rejects unsupported sorts", () => {
  assert.deepEqual(browseQuerySchema.parse({ page: "2", limit: "50" }).page, 2);
  assert.equal(browseQuerySchema.safeParse({ limit: "500" }).success, false);
  assert.equal(browseQuerySchema.safeParse({ sort: "trending" }).success, false);
});

test("listing schema rejects unsafe URLs and privileged client fields", () => {
  const valid = {
    repository: "owner/tool",
    name: "Tool",
    summary: "A useful tool",
    description: "A description",
    category: "Utilities",
    screenshots: [],
    iconUrl: "",
    websiteUrl: "",
    webUrl: "",
    releaseId: null,
    assets: [],
  };
  assert.equal(listingSchema.safeParse(valid).success, true);
  assert.equal(listingSchema.safeParse({ ...valid, screenshots: [{ url: "https://images.example/screen.png", alt: "Main window" }] }).success, true);
  assert.equal(listingSchema.safeParse({ ...valid, repository: "https://evil.test/owner/tool" }).success, false);
  assert.equal(listingSchema.safeParse({ ...valid, iconUrl: "javascript:alert(1)" }).success, false);
  assert.equal(listingSchema.safeParse({ ...valid, status: "published" }).success, false);
});

test("patch validation preserves omitted fields and rejects an empty update", () => {
  assert.deepEqual(updateListingSchema.parse({ name: "Renamed" }), { name: "Renamed" });
  assert.equal(updateListingSchema.safeParse({}).success, false);
});

test("publication requires a category and either a stable installer release or web app URL", () => {
  assert.equal(publicationEligible({ webUrl: null, hasCategory: true, hasOpenSourceLicense: true, hasStableRelease: true, hasCompatibleAsset: true }), true);
  assert.equal(publicationEligible({ webUrl: "https://example.com", hasCategory: true, hasOpenSourceLicense: true, hasStableRelease: false, hasCompatibleAsset: false }), true);
  assert.equal(publicationEligible({ webUrl: null, hasCategory: true, hasOpenSourceLicense: false, hasStableRelease: true, hasCompatibleAsset: true }), false);
  assert.equal(publicationEligible({ webUrl: null, hasCategory: true, hasOpenSourceLicense: true, hasStableRelease: true, hasCompatibleAsset: false }), false);
  assert.equal(publicationEligible({ webUrl: null, hasCategory: false, hasOpenSourceLicense: true, hasStableRelease: true, hasCompatibleAsset: true }), false);
});

test("repository parser accepts only canonical GitHub owner/repository inputs", () => {
  assert.equal(repositoryName("https://github.com/owner/tool.git"), "owner/tool");
  assert.throws(() => repositoryName("https://example.com/owner/tool"));
});

test("release page URLs must be canonical HTTPS GitHub release pages for that repository", () => {
  assert.equal(isOfficialReleaseUrl("https://github.com/owner/tool/releases/tag/v1", "owner/tool"), true);
  assert.equal(isOfficialReleaseUrl("https://github.com/other/tool/releases/tag/v1", "owner/tool"), false);
  assert.equal(isOfficialReleaseUrl("https://github.com.evil.test/owner/tool/releases/tag/v1", "owner/tool"), false);
});

test("release classification rejects archives rather than presenting them as installers", () => {
  const source = classifyAsset({
    id: 1,
    name: "source.zip",
    size: 1234,
    state: "uploaded",
    browser_download_url: "https://github.com/owner/tool/releases/download/v1/source.zip",
  }, 2);
  assert.equal(source.eligible, false);
});

test("OAuth callback reports a generic failure for missing codes and exchange errors", async () => {
  const failUrl = "https://commons.example/?auth=failed";
  let exchangeCalled = false;
  assert.equal(await resolveOAuthCallback({
    code: null,
    next: null,
    origin: "https://commons.example",
    exchangeCodeForSession: async () => {
      exchangeCalled = true;
      return { error: null };
    },
  }), failUrl);
  assert.equal(exchangeCalled, false);

  assert.equal(await resolveOAuthCallback({
    code: "authorization-code",
    next: null,
    origin: "https://commons.example",
    exchangeCodeForSession: async () => ({ error: new Error("sensitive provider error") }),
  }), failUrl);
});

test("OAuth callback hides thrown exchange details and rejects unsafe post-login redirects", async () => {
  const failUrl = "https://commons.example/?auth=failed";
  assert.equal(await resolveOAuthCallback({
    code: "authorization-code",
    next: null,
    origin: "https://commons.example",
    exchangeCodeForSession: async () => {
      throw new Error("sensitive provider error");
    },
  }), failUrl);
  assert.equal(await resolveOAuthCallback({
    code: "authorization-code",
    next: "//attacker.example/path",
    origin: "https://commons.example",
    exchangeCodeForSession: async () => ({ error: null }),
  }), "https://commons.example/");
  assert.equal(await resolveOAuthCallback({
    code: "authorization-code",
    next: "/dashboard",
    origin: "https://commons.example",
    exchangeCodeForSession: async () => ({ error: null }),
  }), "https://commons.example/dashboard");
});

test("authenticated user recognition requires a Supabase user without an auth error", () => {
  const user = { id: "user-123", identities: [{ provider: "github" }] };
  assert.equal(requireAuthenticatedUser(user, null), user);
  assert.throws(
    () => requireAuthenticatedUser(null, null),
    (error) => error.code === "UNAUTHENTICATED" && error.status === 401,
  );
  assert.throws(
    () => requireAuthenticatedUser(user, new Error("auth failure")),
    (error) => error.code === "UNAUTHENTICATED" && error.message === "Sign in to continue.",
  );
});

test("missing or non-GitHub provider tokens fail safely without exposing token details", () => {
  const githubUser = { identities: [{ provider: "github" }] };
  assert.throws(
    () => requireGithubProviderToken(null, githubUser),
    (error) => error.code === "GITHUB_TOKEN_UNAVAILABLE"
      && error.status === 403
      && !error.message.includes("secret"),
  );
  assert.throws(
    () => requireGithubProviderToken({ provider_token: "private-token" }, { identities: [{ provider: "google" }] }),
    (error) => error.code === "GITHUB_TOKEN_UNAVAILABLE",
  );
  assert.equal(
    requireGithubProviderToken({ provider_token: "private-token" }, githubUser),
    "private-token",
  );
});

test("server diagnostics retain database codes while redacting tokens and cookies", () => {
  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const error = Object.assign(new Error("relation applications does not exist"), {
      code: "PGRST205",
      details: "Bearer ghp_exampletoken; provider_token=private-value; Cookie=session-value",
      hint: "Check the database schema cache.",
    });
    logServerError("API request failed", error);
  } finally {
    console.error = originalConsoleError;
  }
  const output = JSON.stringify(logged);
  assert.match(output, /PGRST205/);
  assert.match(output, /relation applications does not exist/);
  assert.match(output, /Check the database schema cache/);
  assert.doesNotMatch(output, /ghp_exampletoken|private-value|session-value/);
  assert.match(output, /\[REDACTED\]/);
});
