import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifiedRepository,
  validateSelection,
} from "../lib/backend/publishing-snapshot.ts";
import { resolveDownload } from "../lib/backend/download-selection.ts";
import { errorResponse } from "../lib/backend/errors.ts";
const repository = {
  id: 1,
  full_name: "owner/app",
  name: "app",
  description: "An app",
  html_url: "https://github.com/owner/app",
  homepage: "",
  owner: { login: "owner", avatar_url: "" },
  license: { spdx_id: "MIT" },
};
const asset = {
  id: 3,
  name: "app-x64.exe",
  size: 100,
  state: "uploaded",
  browser_download_url:
    "https://github.com/owner/app/releases/download/v1/app-x64.exe",
};
const release = {
  id: 2,
  tag_name: "v1",
  published_at: null,
  body: "Release",
  html_url: "https://github.com/owner/app/releases/tag/v1",
  draft: false,
  prerelease: false,
  assets: [asset],
};
const input = {
  repository: "owner/app",
  releaseId: 2,
  assets: [{ id: 3, platform: "windows", architecture: "x64" }],
  webUrl: "",
};
test("verified snapshots exclude prereleases and foreign assets and normalize ambiguous licences", () => {
  const imported = verifiedRepository(repository, [
    release,
    { ...release, id: 4, prerelease: true },
    { ...release, id: 5, draft: true },
    {
      ...release,
      id: 6,
      html_url: "https://github.com/other/app/releases/tag/v1",
    },
  ]);
  assert.equal(imported.releases.length, 1);
  assert.equal(imported.releases[0].assets.length, 1);
  assert.equal(
    verifiedRepository(
      { ...repository, license: { spdx_id: "NOASSERTION" } },
      [],
    ).license,
    null,
  );
});
test("submission requires selected valid assets rather than any installer in the repository", () => {
  const imported = verifiedRepository(repository, [release]);
  assert.doesNotThrow(() => validateSelection(input, imported, true));
  assert.throws(
    () => validateSelection({ ...input, assets: [] }, imported, true),
    (e) => e.code === "INCOMPLETE_RELEASE",
  );
  assert.throws(
    () =>
      validateSelection(
        {
          ...input,
          assets: [{ id: 3, platform: "macos", architecture: "x64" }],
        },
        imported,
        true,
      ),
    (e) => e.code === "INVALID_ASSET",
  );
  assert.throws(
    () =>
      validateSelection(
        { ...input, assets: [...input.assets, ...input.assets] },
        imported,
        true,
      ),
    (e) => e.code === "INVALID_ASSET",
  );
  assert.throws(
    () => validateSelection(input, verifiedRepository(repository, []), true),
    (e) => e.code === "INVALID_RELEASE",
  );
  assert.throws(
    () => validateSelection(input, { ...imported, license: null }, true),
    (e) => e.code === "LICENSE_REQUIRED",
  );
});
test("web-only submissions need no desktop release and incomplete drafts can still be saved", () => {
  const imported = verifiedRepository(repository, []);
  assert.doesNotThrow(() =>
    validateSelection(
      { releaseId: null, assets: [], webUrl: "https://example.test" },
      imported,
      true,
    ),
  );
  assert.doesNotThrow(() =>
    validateSelection(
      { releaseId: null, assets: [], webUrl: "" },
      imported,
      false,
    ),
  );
});
const candidate = {
  id: "first",
  file_name: "app-x64.exe",
  download_url: asset.browser_download_url,
  architecture: "x64",
  file_size_bytes: 100,
};
test("multiple installers with the same architecture require an exact asset choice", () => {
  const second = {
    ...candidate,
    id: "second",
    file_name: "app-x64.msi",
    download_url:
      "https://github.com/owner/app/releases/download/v1/app-x64.msi",
  };
  assert.throws(
    () =>
      resolveDownload([candidate, second], "owner/app", "windows", null, "x64"),
    (e) =>
      e.code === "ASSET_SELECTION_REQUIRED" &&
      e.details[1].assetId === "second",
  );
  assert.equal(
    resolveDownload([candidate, second], "owner/app", "windows", "second")
      .format,
    "msi",
  );
});
test("unknown architectures require explicit selection, and foreign URLs or IDs cannot be selected", () => {
  assert.throws(
    () =>
      resolveDownload(
        [{ ...candidate, architecture: "unknown" }],
        "owner/app",
        "windows",
      ),
    (e) => e.code === "ASSET_SELECTION_REQUIRED",
  );
  assert.equal(
    resolveDownload(
      [{ ...candidate, architecture: "unknown" }],
      "owner/app",
      "windows",
      "first",
    ).architecture,
    "unknown",
  );
  assert.throws(
    () => resolveDownload([candidate], "owner/app", "windows", "foreign"),
    (e) => e.code === "ASSET_NOT_FOUND",
  );
  assert.throws(
    () =>
      resolveDownload(
        [{ ...candidate, download_url: "https://evil.test/payload.exe" }],
        "owner/app",
        "windows",
      ),
    (e) => e.code === "ASSET_NOT_FOUND",
  );
});
test("database conflict, lock, and migration errors expose actionable safe envelopes", async () => {
  for (const [code, status] of [
    ["40001", 409],
    ["55000", 409],
    ["P0002", 404],
    ["PGRST202", 503],
    ["PGRST205", 503],
  ]) {
    const response = errorResponse({ code, message: "secret" });
    assert.equal(response.status, status);
    assert.equal(
      JSON.stringify(await response.json()).includes("secret"),
      false,
    );
  }
});
