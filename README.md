# Commons

A consumer marketplace frontend for discovering open-source software. The latest design is light-first: an editorial Discover page, persistent desktop sidebar, sticky global search, blue accents, self-hosted Inter, and genuine application screenshots. It follows the user’s 60% Mac App Store / 25% Raycast / 15% Setapp brief while keeping its own identity.

## Development

Node.js 20.9+ required.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Validation: `npm run lint`, `npm run typecheck`, `npm run build`.

## Architecture

```
+---------------------------------------------------------------+
|                            Browser                            |
|   Marketplace          Developer portal         Admin portal  |
|   /, /apps             /developer               /admin        |
+---------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|                    Next.js app (App Router)                   |
|                                                               |
|   Pages (server components) ---> API routes (app/api/*)       |
|            |                              |                   |
|            v                              v                   |
|   Sample fixtures             lib/backend (auth, publishing,  |
|   (no MARKETPLACE_API_URL)    review, downloads)              |
+---------------------------------------------------------------+
                    |                               |
                    v                               v
       +-------------------------+     +-------------------------+
       |        Supabase         |     |       GitHub API        |
       |   Auth (GitHub OAuth)   |     |   repos, releases,      |
       |   Postgres + RLS        |     |   search                |
       +-------------------------+     +-------------------------+
```

Installers download directly from canonical github.com release URLs; the app only resolves which one.

## Routes and components

- `/`: two screenshot-led features, compact app listings, an explicitly labeled New & Noteworthy sample selection, category collections, and a developer invitation.
- `/apps`: functional search by name/description/category/developer, category/platform/license filtering, featured or alphabetical sorting, reset, grid/list views, and empty states.
- `/apps` search also queries GitHub’s public repository search after the user pauses typing, showing public repositories as Commons-style app tiles ordered by star count. Selecting a tile opens a repository detail page with available stable-release installers; only canonical GitHub release assets are downloadable. Public-repository previews need no sign-in, while saving or submitting a listing still requires GitHub account access and repository-maintainer verification. GitHub’s public search rate limit applies.
- `/explore`: preserved legacy route using the same Browse page.
- `/apps/[slug]`: app identity, gallery, manual platform selection, official download/release fallback, description, features, available metadata, release-note fallback, source link, and related apps.
- `/about`: open-source explanation and honest publishing-portal handoff.

`components/navigation.tsx` owns the responsive shell. `components/brand.tsx` owns the wordmark. `components/marketplace.tsx` provides shared cards (standard/compact/preview), editorial features, categories, and section headings. `components/explore.tsx` owns interactive catalog controls. `components/app-details.tsx` owns the gallery and distribution UI. `components/ui/button.tsx` follows the shadcn/ui Button pattern with Radix Slot and CVA.

Design tokens and responsive rules live in `app/globals.css`. Tailwind CSS remains configured. Asset URLs and attribution are recorded in `public/ASSETS.md` and adjacent provenance JSON files. Inter is served locally with its license; the browser makes no Google Fonts request.

## Member 2: marketplace integration

The backend is implemented with Supabase Auth/Postgres, versioned migrations, RLS, Zod validation, GitHub repository verification, and App Router APIs. Set `MARKETPLACE_API_URL=http://localhost:3000/api` in `.env.local` to use live public APIs. Leave it unset for the explicitly labeled fixtures in `lib/fixtures.ts`.

`lib/api.ts` is the consumer integration adapter. It unwraps the documented envelopes and maps backend records to the consumer's `MarketplaceApp` type:

- `GET /api/apps?limit=50` → paginated published listings.
- `GET /api/apps/{slug}` → one published listing, `404` when missing/unpublished.
- `GET /api/categories` → public category names and counts.
- `GET /api/apps/{slug}/download?platform=windows` → validated release URL when a single compatible asset is determinable.

Filtering, sorting and search parameters plus response/error shapes are documented in [docs/api-contracts.md](./docs/api-contracts.md). Local consumer search still filters the fetched first page; use API query parameters and pagination for a complete large catalog.

## Member 3: developer publishing and distribution

The portal at `/developer` now connects to the authenticated backend. Sign in with GitHub, verify a public repository you maintain, configure a listing and selected stable installers, save it to your account, preview it, and **submit for review**. Approved listings appear in the marketplace. Published applications can prepare updates without changing the current public version.

Apply **both** migrations before using the account workflow, including `supabase/migrations/202610170002_publisher_revisions.sql`. The latter adds private review snapshots, optimistic version checks, and transactional save/submission/approval functions. A read-only check of the configured project during implementation reported the new revision table missing; no hosted schema was modified.

Local previews remain available without sign-in. Browser drafts are recovery copies, not public listings. Importing a local draft into an account is explicit; successful server saves remove the recovery copy. Account-bound recovery drafts are not shown to other accounts. All ownership, licence and release checks are repeated on the server.

Live app pages use `/api/apps/{slug}/download` automatically. The resolver returns a JSON `data` envelope and exact installer choices when ambiguous. Users choose their operating system and, when needed, the specific installer; unknown processor compatibility requires confirmation. Direct downloads remain on canonical GitHub release URLs. Supported desktop formats: EXE, MSI, DMG, PKG, AppImage, DEB and RPM. Web apps have a separate “Open web app” action. No installation or software-safety claim is made.

The public `/api/developer/import` and preview `/api/developer/download` remain available for local previews; they are not proof of repository ownership. The protected publishing flow uses `/api/developer/repositories/verify` and persisted revisions instead.

Contracts and review operations: [docs/member-3-contracts.md](docs/member-3-contracts.md), [docs/api-contracts.md](docs/api-contracts.md), and [docs/backend-setup.md](docs/backend-setup.md).

## Validation and limits

- `npm test`: unit/distribution checks plus embedded PostgreSQL migration, revision, rollback, and RLS tests.
- `npm run typecheck`, `npm run lint`, `npm run build`: static and production checks.
- `npx playwright install chromium` followed by `npm run test:browser`: isolated browser checks with API fixtures. The runner copies source to a temporary directory, so it does not stop an existing development server. Port 3103 must be available. `E2E_BASE_URL` can target an already running fixture-mode server instead; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium binary.

Browser fixtures exercise UI state and request contracts; PostgreSQL tests exercise actual SQL functions and policies. Neither substitutes for a real GitHub OAuth → hosted database → moderator approval → download check. That final hosted journey requires the new migration and a signed-in publisher with a real supported release. See [docs/member-3-validation.md](docs/member-3-validation.md).
