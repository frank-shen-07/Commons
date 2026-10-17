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

There is no backend in this repository. `lib/api.ts` is the sole marketplace adapter; `lib/types.ts` defines **proposed, unconfirmed** contracts. Keep `MARKETPLACE_API_URL` unset for the labeled fixtures in `lib/fixtures.ts`.

After agreeing the contract, set the base URL (including `/api` if used) and adapt these routes if needed:

- `GET /apps` → `MarketplaceApp[]`
- `GET /apps/:slug` → `MarketplaceApp`, HTTP 404 when missing
- `GET /categories` → `string[]`

Additional presentation fields are `websiteUrl`, `color`, and `features`. Optional enrichment types cover developer, release, compatibility, and category data. Normalize team responses in the adapter. API failures surface the retry UI instead of silently substituting samples.

Search, filters, and sorting currently operate on the fetched catalog in the browser. Paginated server search requires an agreed contract. No popularity or release-date sorting is offered without meaningful source data. The Discover collection uses editorial ordering, not a fabricated trending ranking. Unknown versions, dates, and release notes are not invented. Only OBS Studio and LibreOffice currently have screenshots; other apps have a missing-image state.

## Member 3: developer portal and distribution

The portal is available at `/developer`. Import a **public** GitHub repository, configure its description, screenshots and stable release assets, preview the listing, and save a draft in browser storage. Drafts can be reopened, deleted, or exported as JSON. No credentials or new packages are required.

Per the current integration scope, OAuth, ownership verification, database persistence, public publication, and marketplace ingestion are deferred to Member 2. The Publish step explicitly explains this and cannot publish. Public import does not establish publisher ownership. Existing marketplace sample data remains separate from local drafts.

`GET /api/developer/import?repository=owner/repo` reads public metadata, licence, README and up to 20 recent releases using GitHub's unauthenticated REST API. Drafts and prereleases are excluded. This API is subject to GitHub's unauthenticated rate limits.

`GET /api/developer/download?repository=owner/repo&releaseId=123&assetId=456&platform=windows` re-fetches the release, checks asset membership, format and platform, and redirects only to that repository's HTTPS GitHub release download URL. This route supports draft-preview downloads; it does not claim publisher verification or software safety. Desktop installers supported: EXE, MSI, DMG, PKG, AppImage, DEB, RPM. Generic ZIP/TAR archives are excluded. Users explicitly choose a platform and named installer; unknown architectures remain labelled unknown.

Implementation and future backend contracts: [docs/member-3-contracts.md](docs/member-3-contracts.md). Run the dependency-free distribution checks on Node 24 with `node --test tests/publishing.test.mjs`.

The existing marketplace `DISTRIBUTION_DOWNLOAD_URL` adapter remains reserved for a future published-listing resolver. Do not point it at the draft download redirect: the marketplace expects a JSON `DownloadOption`, while the preview endpoint returns a redirect.

## Validation and limits

Production build, TypeScript, and ESLint pass. Playwright covers global/developer search, category/platform/license filters, reset, sorting, grid/list views, keyboard search, screenshot next/previous, unsupported devices, GitHub Releases fallback, missing screenshots/apps, legacy route, sticky shell, image loading, and horizontal overflow at 1440, 1024, 768, and 390 pixels. Captures and a QA record are under `.impeccable/review/`.

Live catalog/distribution APIs and the publishing portal remain integration tasks. Loading and retry components are implemented; no live-backend outage simulation was performed. The full dependency audit retains development-only findings through ESLint’s glob/micromatch/braces chain; the prior production audit reported no vulnerabilities.

### Member 3 validation in this workspace

Focused distribution tests and TS/TSX syntax checks passed. Full Next.js build, typecheck, lint, and browser/live GitHub journey verification were unavailable: dependency installation failed because the npm registry could not be resolved. The validation statements above describe the pre-existing frontend, not the new portal.
