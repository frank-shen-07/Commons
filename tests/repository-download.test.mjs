import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRepositoryDownload } from "../lib/publishing/repository-download.ts";

const release = {
  id: 21,
  version: "v1.0",
  publishedAt: "2026-10-17T00:00:00Z",
  notes: "Release notes",
  url: "https://github.com/owner/app/releases/tag/v1.0",
  assets: [
    {
      id: 31,
      releaseId: 21,
      name: "App-x64.exe",
      size: 1000,
      url: "https://github.com/owner/app/releases/download/v1.0/App-x64.exe",
      platform: "windows",
      architecture: "x64",
      format: "exe",
      eligible: true,
      reason: "Supported installer",
    },
    {
      id: 32,
      releaseId: 21,
      name: "App-arm64.exe",
      size: 1200,
      url: "https://github.com/owner/app/releases/download/v1.0/App-arm64.exe",
      platform: "windows",
      architecture: "arm64",
      format: "exe",
      eligible: true,
      reason: "Supported installer",
    },
    {
      id: 33,
      releaseId: 21,
      name: "App.exe",
      size: 1000,
      url: "https://evil.example/owner/app/releases/download/v1.0/App.exe",
      platform: "windows",
      architecture: "x64",
      format: "exe",
      eligible: true,
      reason: "Supported installer",
    },
  ],
};

test("public repository download requires a choice for ambiguous installers", () => {
  const resolution = resolveRepositoryDownload(
    [release],
    "owner/app",
    "windows",
    null,
  );
  assert.equal(resolution.kind, "choices");
  assert.deepEqual(
    resolution.choices.map((asset) => asset.assetId),
    ["31", "32"],
  );
});

test("public repository download resolves only official assets from the latest compatible release", () => {
  const resolution = resolveRepositoryDownload(
    [release],
    "owner/app",
    "windows",
    "31",
  );
  assert.equal(resolution.kind, "available");
  assert.equal(
    resolution.option.url,
    "https://github.com/owner/app/releases/download/v1.0/App-x64.exe",
  );
  assert.equal(resolution.option.platform, "windows");

  const rejected = resolveRepositoryDownload(
    [release],
    "owner/app",
    "windows",
    "33",
  );
  assert.equal(rejected.kind, "unavailable");
  assert.match(rejected.message, /no longer available/i);
});

test("public repository download picks the newest release with a compatible installer", () => {
  const newerRelease = {
    ...release,
    id: 22,
    version: "v2.0",
    assets: [
      {
        ...release.assets[0],
        id: 41,
        releaseId: 22,
        url: "https://github.com/owner/app/releases/download/v2.0/App-x64.exe",
      },
    ],
  };
  const resolution = resolveRepositoryDownload(
    [newerRelease, release],
    "owner/app",
    "windows",
    null,
  );
  assert.equal(resolution.kind, "available");
  assert.equal(
    resolution.option.url,
    "https://github.com/owner/app/releases/download/v2.0/App-x64.exe",
  );
});

test("public repository download reports when no compatible stable installer exists", () => {
  const resolution = resolveRepositoryDownload(
    [release],
    "owner/app",
    "macos",
    null,
  );
  assert.equal(resolution.kind, "unavailable");
  assert.match(resolution.message, /official releases/);
});
