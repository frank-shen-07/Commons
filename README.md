# Commons

A consumer marketplace frontend for discovering open-source software. The latest design is light-first: an editorial Discover page, persistent desktop sidebar, sticky global search, blue accents, self-hosted Inter, and genuine application screenshots. It follows the user’s 60% Mac App Store / 25% Raycast / 15% Setapp brief while keeping its own identity.

## Development

Node.js 20.9+ required.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Validation: `npm run lint`, `npm run typecheck`, `npm run build`.

## Routes and components

- `/`: two screenshot-led features, compact app listings, an explicitly labeled New & Noteworthy sample selection, category collections, and a developer invitation.
- `/apps`: functional search by name/description/category/developer, category/platform/license filtering, featured or alphabetical sorting, reset, grid/list views, and empty states.
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

## Member 3: developer portal and distribution

The portal is available at `/developer`. It currently imports a public GitHub repository and saves editable drafts in browser storage; it does not yet invoke the authenticated backend APIs. The backend contracts are ready for portal integration, but the UI still marks local drafts as unpublished.

`GET /api/developer/import?repository=owner/repo` remains an unauthenticated preview and does not establish ownership. For persistence, sign in through `/api/auth/github`, verify using `GET /api/developer/repositories/verify?repository=owner/repo`, submit a listing to `POST /api/apps`, edit it via `PATCH /api/apps/{id}`, then submit it via `POST /api/apps/{id}/publish`. The publish operation submits to moderation (`pending_review`), not public visibility.

`GET /api/developer/download?repository=owner/repo&releaseId=123&assetId=456&platform=windows` re-fetches the release, checks asset membership, format and platform, and redirects only to that repository's HTTPS GitHub release download URL. This route supports draft-preview downloads; it does not claim publisher verification or software safety. Desktop installers supported: EXE, MSI, DMG, PKG, AppImage, DEB, RPM. Generic ZIP/TAR archives are excluded. Users explicitly choose a platform and named installer; unknown architectures remain labelled unknown.

Implementation and future backend contracts: [docs/member-3-contracts.md](docs/member-3-contracts.md). Run the dependency-free distribution checks on Node 24 with `node --test tests/publishing.test.mjs`.

The published-listing resolver returns JSON compatible with `DownloadOption`; the preview download endpoint remains a separate redirect flow. See [docs/backend-setup.md](./docs/backend-setup.md) and [docs/api-contracts.md](./docs/api-contracts.md) for OAuth, setup, request fields, errors, and moderation setup.

## Validation and limits

Backend validation run in this workspace:

- `npm test` — 13 tests passed (Node 24).
- `npm run typecheck`, `npm run lint`, and `npm run build` — passed.
- `npm audit --omit=dev` — no production dependency vulnerabilities found.
- Full `npm audit` still reports 5 high-severity findings in the existing development-only ESLint → fast-glob → micromatch → braces chain. npm's suggested fix is a breaking downgrade of `eslint-config-next`; it was not applied.

No Supabase credentials, local Postgres client, or Docker are configured here, so the migration was not applied and RLS/OAuth/GitHub live integration tests were not run. See [docs/backend-setup.md](./docs/backend-setup.md) for remaining setup and [docs/api-contracts.md](./docs/api-contracts.md) for endpoint guarantees. The developer portal UI still needs to be wired to the new authenticated APIs.

The earlier frontend browser QA captures and notes under `.impeccable/review/` are pre-existing checks and were not rerun as part of the backend work.
