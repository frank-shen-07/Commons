import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, mkdtemp, cp, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

// The browser checks use API fixtures. Real PostgreSQL transactions/RLS are tested separately.
const root = resolve(import.meta.dirname, "../..");
let browser, server, copy;
let base = process.env.E2E_BASE_URL;
const shots = join(root, ".impeccable/review/member3");
before(
  async () => {
    if (!base) {
      copy = await mkdtemp(join(tmpdir(), "commons-browser-"));
      for (const dir of ["app", "components", "lib", "src", "public"])
        await cp(join(root, dir), join(copy, dir), { recursive: true });
      for (const file of [
        "package.json",
        "tsconfig.json",
        "postcss.config.mjs",
        "AGENTS.md",
      ])
        await cp(join(root, file), join(copy, file));
      await symlink(
        join(root, "node_modules"),
        join(copy, "node_modules"),
        "dir",
      );
      base = "http://127.0.0.1:3103";
      server = spawn(
        process.execPath,
        [
          join(root, "node_modules/next/dist/bin/next"),
          "dev",
          copy,
          "--webpack",
          "--port",
          "3103",
          "--hostname",
          "127.0.0.1",
        ],
        {
          env: {
            ...process.env,
            MARKETPLACE_API_URL: "",
            DISTRIBUTION_DOWNLOAD_URL: "/api/apps/{slug}/download",
            NEXT_TELEMETRY_DISABLED: "1",
          },
          stdio: "ignore",
        },
      );
      let ready = false;
      for (let i = 0; i < 120; i++) {
        if (server.exitCode !== null)
          throw new Error(
            "Isolated browser-test server failed to start. Check port 3103.",
          );
        try {
          if ((await fetch(base + "/developer")).ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!ready) throw new Error("Isolated browser-test server timed out.");
    }
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });
    await mkdir(shots, { recursive: true });
  },
  { timeout: 90000 },
);
after(async () => {
  await browser?.close();
  if (server) {
    if (server.exitCode === null) {
      const stopped = new Promise((resolve) => server.once("exit", resolve));
      server.kill("SIGTERM");
      await stopped;
    }
  }
  if (copy) await rm(copy, { recursive: true, force: true });
});
const id = "10000000-0000-4000-8000-000000000001";
const repo = {
  id: 11,
  fullName: "owner/app",
  name: "App",
  description: "A useful application",
  url: "https://github.com/owner/app",
  websiteUrl: "",
  owner: "owner",
  avatarUrl: "",
  license: "MIT",
  readme: "Read me",
  releases: [
    {
      id: 21,
      version: "v1",
      publishedAt: null,
      notes: "Release",
      url: "https://github.com/owner/app/releases/tag/v1",
      assets: [
        {
          id: 31,
          releaseId: 21,
          name: "App-x64.exe",
          size: 1000,
          url: "https://github.com/owner/app/releases/download/v1/App-x64.exe",
          platform: "windows",
          architecture: "x64",
          format: "exe",
          eligible: true,
          reason: "Supported installer",
        },
      ],
    },
  ],
};
const initial = {
  repository: "owner/app",
  name: "App",
  summary: "A useful application",
  description: "A useful application",
  category: "Utilities",
  screenshots: [],
  iconUrl: "",
  websiteUrl: "",
  webUrl: "",
  releaseId: 21,
  assets: [{ id: 31, platform: "windows", architecture: "x64" }],
};
function listing(
  input = initial,
  version = 1,
  status = "draft",
  revisionStatus = "draft",
) {
  return {
    ...input,
    id,
    slug: "app",
    name: input.name,
    repository: "owner/app",
    status,
    revisionStatus,
    version,
    updatedAt: new Date().toISOString(),
    snapshot: { input, repository: repo, categoryId: id },
  };
}
async function workspace({ signed = true, saved = null, stale = false } = {}) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const state = {
    signed,
    saved,
    stale,
    creates: 0,
    submits: 0,
    imports: [],
    downloads: [],
  };
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      method = route.request().method();
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/api/auth/me")
      return state.signed
        ? json({ data: { id: "publisher", githubUsername: "owner" } })
        : json(
            {
              error: {
                code: "UNAUTHENTICATED",
                message: "Sign in to continue.",
              },
            },
            401,
          );
    if (path === "/api/categories")
      return json({ data: [{ id, name: "Utilities", slug: "utilities" }] });
    if (path === "/api/developer/import") {
      const repository = url.searchParams.get("repository");
      state.imports.push(repository);
      return json(
        repository === "owner/app"
          ? repo
          : {
              ...repo,
              fullName: repository,
              name: repository.split("/")[1],
              owner: repository.split("/")[0],
              url: `https://github.com/${repository}`,
            },
      );
    }
    if (path === "/api/developer/repository-download") {
      const repository = url.searchParams.get("repository");
      state.downloads.push({
        repository,
        platform: url.searchParams.get("platform"),
        assetId: url.searchParams.get("assetId"),
      });
      return json({
        data: {
          platform: "windows",
          url: `https://github.com/${repository}/releases/download/v1/App-x64.exe`,
          label: "App-x64.exe",
          architecture: "x64",
          format: "exe",
          instructions: "Open the downloaded installer and follow its instructions.",
        },
      });
    }
    if (path === "/api/developer/repositories/verify")
      return json({ data: repo });
    if (path === "/api/developer/apps")
      return json({ data: state.saved ? [state.saved] : [] });
    if (path === "/api/apps" && method === "POST") {
      state.creates++;
      state.saved = listing(route.request().postDataJSON());
      return json({ data: state.saved }, 201);
    }
    if (path === `/api/developer/apps/${id}`)
      return json({ data: state.saved });
    if (path.endsWith("/draft/reopen")) {
      state.saved = {
        ...state.saved,
        version: state.saved.version + 1,
        revisionStatus: "draft",
        status: state.saved.status === "published" ? "published" : "draft",
      };
      return json({ data: state.saved });
    }
    if (path.endsWith("/draft") && method === "PUT") {
      if (state.stale)
        return json(
          {
            error: {
              code: "STALE_DRAFT",
              message:
                "This draft changed elsewhere. Reload the latest saved version before continuing.",
            },
          },
          409,
        );
      const body = route.request().postDataJSON();
      assert.equal(body.expectedVersion, state.saved.version);
      state.saved = listing(
        body.input,
        state.saved.version + 1,
        state.saved.status,
        "draft",
      );
      return json({ data: state.saved });
    }
    if (path.endsWith("/submit")) {
      state.submits++;
      state.saved = {
        ...state.saved,
        version: state.saved.version + 1,
        revisionStatus: "pending_review",
        status:
          state.saved.status === "published" ? "published" : "pending_review",
      };
      return json({ data: state.saved }, 202);
    }
    return json(
      { error: { code: "NOT_FOUND", message: "Test route not configured." } },
      404,
    );
  });
  return { context, page, state };
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "horizontal overflow",
  );
}

test(
  "browse search uses Discover tiles that open repository details and a compatible download",
  { timeout: 90000 },
  async () => {
    const { context, page, state } = await workspace({ signed: false });
    let githubSearchUrl;
    await context.route("https://api.github.com/**", async (route) => {
      githubSearchUrl = new URL(route.request().url());
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          total_count: 3,
          items: [
            {
              id: 2,
              full_name: "photocraft/less-popular",
              description: "A photo editor",
              stargazers_count: 12,
              language: "Rust",
              html_url: "https://github.com/photocraft/less-popular",
              owner: {
                avatar_url: "https://avatars.githubusercontent.com/u/2",
              },
              private: false,
              archived: false,
            },
            {
              id: 1,
              full_name: "photocraft/most-popular",
              description: "Another photo editor",
              stargazers_count: 850,
              language: "TypeScript",
              html_url: "https://github.com/photocraft/most-popular",
              owner: {
                avatar_url: "https://avatars.githubusercontent.com/u/1",
              },
              private: false,
              archived: false,
            },
            {
              id: 3,
              full_name: "photocraft/archived",
              description: "Archived project",
              stargazers_count: 9000,
              language: null,
              html_url: "https://github.com/photocraft/archived",
              owner: {
                avatar_url: "https://avatars.githubusercontent.com/u/3",
              },
              private: false,
              archived: true,
            },
          ],
        }),
      });
    });
    await context.route(
      "https://github.com/**/releases/download/v1/App-x64.exe",
      (route) =>
        route.fulfill({
          headers: {
            "Content-Disposition": 'attachment; filename="App-x64.exe"',
          },
          contentType: "application/octet-stream",
          body: "test download bytes",
        }),
    );
    try {
      await page.goto(base + "/apps");
      await page
        .getByLabel("Search apps and public GitHub repositories")
        .fill("photocraft");
      await page
        .getByLabel("Search apps and public GitHub repositories")
        .press("Enter");
      await page.waitForURL(/\/apps\?q=photocraft$/);
      const results = page.locator(".github-results .app-card-compact");
      await results.first().waitFor();
      assert.equal(
        await results.nth(0).locator(".app-card-copy h3").innerText(),
        "most-popular",
      );
      assert.equal(
        await results.nth(1).locator(".app-card-copy h3").innerText(),
        "less-popular",
      );
      assert.match(await results.nth(0).innerText(), /GitHub · 850 stars/);
      assert.equal(githubSearchUrl.searchParams.get("sort"), "stars");
      assert.equal(githubSearchUrl.searchParams.get("order"), "desc");
      assert.match(githubSearchUrl.searchParams.get("q"), /photocraft/);
      assert.match(githubSearchUrl.searchParams.get("q"), /is:public/);

      for (const width of [1440, 1024, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await noOverflow(page);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      assert.equal(
        await results.nth(0).getAttribute("href"),
        "/apps/github/photocraft/most-popular",
      );
      await results.nth(0).click();
      await page.waitForURL(/\/apps\/github\/photocraft\/most-popular$/);
      await page
        .getByRole("heading", { name: "most-popular", exact: true })
        .waitFor();
      await page.getByText(/not a reviewed Commons listing/).waitFor();
      assert.deepEqual(
        [...new Set(state.imports)],
        ["photocraft/most-popular"],
      );
      await page.getByLabel("Choose your device").selectOption("windows");
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download for Windows", exact: true })
        .click();
      await download;
      assert.deepEqual(state.downloads, [
        {
          repository: "photocraft/most-popular",
          platform: "windows",
          assetId: null,
        },
      ]);
    } finally {
      await context.close();
    }
  },
);

test(
  "verified import, persisted save, preview, submission and return to draft",
  { timeout: 90000 },
  async () => {
    const { context, page, state } = await workspace();
    try {
      await page.goto(base + "/developer/publish");
      await page.getByLabel("GitHub repository").fill("owner/app");
      await page
        .getByRole("button", { name: "Import repository", exact: true })
        .click();
      await page.getByLabel("App name", { exact: true }).fill("Everyday App");
      await page.locator(".publisher-asset").getByRole("checkbox").check();
      await page
        .getByRole("button", { name: "Save to my account", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Saved to your account" })
        .waitFor();
      assert.equal(state.creates, 1);
      assert.equal(state.saved.snapshot.input.assets[0].id, 31);
      await page
        .getByRole("button", { name: "Preview listing", exact: true })
        .click();
      await page.getByLabel("Choose your device").selectOption("windows");
      assert.match(
        await page.locator(".publisher-download").innerText(),
        /App-x64.exe/,
      );
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await noOverflow(page);
        await page.evaluate(() => {
          document.activeElement?.blur();
          document.documentElement.style.scrollBehavior = "auto";
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: join(shots, `preview-${width}.png`),
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page
        .getByRole("button", { name: "Submit for review", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Your submission is in review." })
        .waitFor();
      assert.equal(state.submits, 1);
      assert.equal(
        await page
          .getByRole("link", { name: "View current public listing" })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Return to draft", exact: true })
        .click();
      await page.getByLabel("App name", { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("App name", { exact: true }).isEnabled(),
        true,
      );
    } finally {
      await context.close();
    }
  },
);

test(
  "local migration is explicit, account-bound recovery is private, and server conflicts preserve input",
  { timeout: 90000 },
  async () => {
    const { context, page, state } = await workspace();
    const local = {
      id: "local-draft",
      updatedAt: new Date().toISOString(),
      input: initial,
      repository: repo,
    };
    await context.addInitScript((value) => {
      if (!localStorage.getItem("qa-seeded")) {
        localStorage.setItem(
          "commons.publisher.drafts.v1",
          JSON.stringify([
            value,
            {
              ...value,
              id: "other",
              ownerId: "other-user",
              input: { ...value.input, name: "Other account private draft" },
            },
          ]),
        );
        localStorage.setItem("qa-seeded", "1");
      }
    }, local);
    try {
      await page.goto(base + "/developer");
      await page
        .getByRole("heading", { name: "Recovery drafts on this device" })
        .waitFor();
      assert.equal(
        await page.getByText("Other account private draft").count(),
        0,
      );
      assert.equal(state.creates, 0);
      await page.getByRole("link", { name: "Open draft", exact: true }).click();
      await page
        .getByRole("button", { name: "Save to my account", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Saved to your account" })
        .waitFor();
      state.stale = true;
      await page
        .getByLabel("About this app")
        .fill("Unsaved changes must survive a conflict.");
      await page
        .getByRole("button", { name: "Save to account", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "changed elsewhere" })
        .waitFor();
      assert.equal(
        await page.getByLabel("About this app").inputValue(),
        "Unsaved changes must survive a conflict.",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Export unsaved draft" })
          .isVisible(),
        true,
      );
    } finally {
      await context.close();
    }
  },
);

test(
  "published update remains public while its revision enters review",
  { timeout: 90000 },
  async () => {
    const { context, page, state } = await workspace({
      saved: listing(initial, 4, "published", "approved"),
    });
    try {
      await page.goto(base + `/developer/apps/${id}/edit`);
      await page.getByLabel("About this app").fill("An improved release.");
      await page
        .getByRole("button", { name: "Preview listing", exact: true })
        .click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page
        .getByRole("button", { name: "Submit for review", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Your submission is in review." })
        .waitFor();
      assert.equal(state.saved.status, "published");
      assert.equal(state.saved.revisionStatus, "pending_review");
      assert.equal(
        await page
          .getByRole("link", { name: "View current public listing" })
          .isVisible(),
        true,
      );
      assert.match(
        await page.getByRole("status").innerText(),
        /current public listing remains available/,
      );
    } finally {
      await context.close();
    }
  },
);

test(
  "consumer chooses an exact installer, acknowledges unknown compatibility, and receives guidance",
  { timeout: 90000 },
  async () => {
    const context = await browser.newContext({
        viewport: { width: 390, height: 1000 },
      }),
      page = await context.newPage();
    const assetId = "20000000-0000-4000-8000-000000000001";
    await context.route("**/api/apps/obs-studio/download?**", (route) => {
      const url = new URL(route.request().url());
      const body =
        url.searchParams.get("assetId") === assetId
          ? {
              data: {
                platform: "windows",
                url: "https://github.com/owner/app/releases/download/v1/App.exe",
                label: "App.exe",
                architecture: "unknown",
                format: "exe",
                instructions: "Open the installer and follow its instructions.",
              },
            }
          : {
              error: {
                code: "ASSET_SELECTION_REQUIRED",
                message: "Choose an installer.",
                details: [
                  {
                    assetId,
                    fileName: "App.exe",
                    architecture: "unknown",
                    sizeBytes: 1000,
                    format: "exe",
                  },
                ],
              },
            };
      return route.fulfill({
        status: body.data ? 200 : 409,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await context.route(
      "https://github.com/owner/app/releases/download/v1/App.exe",
      (route) =>
        route.fulfill({
          headers: { "Content-Disposition": 'attachment; filename="App.exe"' },
          contentType: "application/octet-stream",
          body: "test download bytes",
        }),
    );
    try {
      await page.goto(base + "/apps/obs-studio");
      await page.getByLabel("Choose your device").selectOption("windows");
      await page
        .getByRole("button", { name: "Download for Windows", exact: true })
        .click();
      await page.getByLabel("Choose an installer").selectOption(assetId);
      assert.equal(
        await page
          .getByRole("button", { name: "Download for Windows", exact: true })
          .isDisabled(),
        true,
      );
      await page.getByRole("checkbox").check();
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download for Windows", exact: true })
        .click();
      await (await downloaded).cancel();
      await page
        .getByText("Open the installer and follow its instructions.", {
          exact: true,
        })
        .waitFor();
      await noOverflow(page);
      await page.screenshot({
        path: join(shots, "consumer-download-390.png"),
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  },
);

test(
  "repository permission errors preserve the repository input",
  { timeout: 60000 },
  async () => {
    const { context, page, state } = await workspace();
    await context.route("**/api/developer/repositories/verify?**", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "REPOSITORY_FORBIDDEN",
            message:
              "Your connected GitHub account does not have repository write access.",
          },
        }),
      }),
    );
    try {
      await page.goto(base + "/developer/publish");
      await page.getByLabel("GitHub repository").fill("owner/app");
      await page
        .getByRole("button", { name: "Import repository", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "write access" })
        .waitFor();
      assert.equal(
        await page.getByLabel("GitHub repository").inputValue(),
        "owner/app",
      );
      assert.equal(state.creates, 0);
      await page.setViewportSize({ width: 390, height: 900 });
      await noOverflow(page);
    } finally {
      await context.close();
    }
  },
);

test(
  "source-only repositories can configure a web app, but missing licences prevent submission",
  { timeout: 60000 },
  async () => {
    const { context, page } = await workspace();
    await context.route("**/api/developer/repositories/verify?**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { ...repo, releases: [], license: null },
        }),
      }),
    );
    try {
      await page.goto(base + "/developer/publish");
      await page.getByLabel("GitHub repository").fill("owner/app");
      await page
        .getByRole("button", { name: "Import repository", exact: true })
        .click();
      await page
        .getByText("No stable releases found.", { exact: false })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Preview listing", exact: true })
          .isDisabled(),
        true,
      );
      await page
        .getByLabel("Web app URL", { exact: false })
        .fill("https://example.test");
      await page
        .getByRole("button", { name: "Preview listing", exact: true })
        .click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      assert.equal(
        await page
          .getByRole("button", { name: "Submit for review", exact: true })
          .isDisabled(),
        true,
      );
      assert.match(
        await page.locator(".publisher-finish").innerText(),
        /has not identified an open-source licence/,
      );
    } finally {
      await context.close();
    }
  },
);

test(
  "unavailable account storage is distinct from an empty application list",
  { timeout: 60000 },
  async () => {
    const { context, page } = await workspace();
    await context.route("**/api/developer/apps", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "MIGRATION_REQUIRED",
            message: "The publishing database needs its latest migration.",
          },
        }),
      }),
    );
    try {
      await page.goto(base + "/developer");
      await page
        .getByRole("alert")
        .filter({ hasText: "latest migration" })
        .waitFor();
      await page
        .getByRole("status")
        .filter({ hasText: "could not be loaded" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Your next release starts here." })
          .count(),
        0,
      );
    } finally {
      await context.close();
    }
  },
);
