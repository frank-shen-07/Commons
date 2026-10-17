import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAsset, installationInstructions } from "../lib/publishing/assets.ts";
import { repositoryName, isOfficialAssetUrl } from "../lib/publishing/validation.ts";
const raw = name => ({ id: 1, name, size: 1024, browser_download_url: "https://github.com/owner/app/releases/download/v1/app.exe", state: "uploaded" });
test("classifies supported operating systems and architectures", () => {
 for (const [name, platform, architecture] of [["app-win-x64.exe", "windows", "x64"], ["app-arm64.dmg", "macos", "arm64"], ["app-universal.pkg", "macos", "universal"], ["app-amd64.deb", "linux", "x64"], ["app-aarch64.AppImage", "linux", "arm64"], ["app-win32.msi", "windows", "x86"], ["app.rpm", "linux", "unknown"]]) { const asset = classifyAsset(raw(name), 9); assert.equal(asset.eligible, true); assert.equal(asset.platform, platform); assert.equal(asset.architecture, architecture); assert.equal(asset.releaseId, 9); }
});
test("excludes source archives, debug assets, signatures, and unavailable uploads", () => {
 for (const name of ["source.zip", "app.tar.gz", "app.exe.sha256", "app-debug.exe", "app-symbols.dmg", "source.exe"]) assert.equal(classifyAsset(raw(name), 1).eligible, false, name);
 assert.equal(classifyAsset({ ...raw("app.exe"), size: 0 }, 1).eligible, false);
 assert.equal(classifyAsset({ ...raw("app.exe"), state: "new" }, 1).eligible, false);
});
test("parses GitHub repositories and rejects foreign origins and traversal", () => {
 assert.equal(repositoryName("https://github.com/owner/app.git/"), "owner/app"); assert.equal(repositoryName("owner/app"), "owner/app");
 for (const value of ["https://evil.test/owner/app", "https://github.com.evil.test/owner/app", "owner/../app", "owner/app?x=y", "owner/..", "http://github.com/owner/app"]) assert.throws(() => repositoryName(value));
});
test("redirects only to release downloads in the requested repository", () => {
 assert.equal(isOfficialAssetUrl(raw("app.exe").browser_download_url, "owner/app"), true);
 for (const url of ["https://evil.test/owner/app/releases/download/v1/app.exe", "https://github.com/other/app/releases/download/v1/app.exe", "javascript:alert(1)", "http://github.com/owner/app/releases/download/v1/app.exe", "https://user:pass@github.com/owner/app/releases/download/v1/app.exe", "https://github.com/owner/app/archive/main.zip", "https://github.com/owner/app/releases/download"]) assert.equal(isOfficialAssetUrl(url, "owner/app"), false, url);
});
test("installation guidance explains OS steps without claiming installation", () => { assert.match(installationInstructions("dmg"), /Applications/); assert.match(installationInstructions("deb"), /distribution/); assert.match(installationInstructions("appimage"), /Allow/); });
