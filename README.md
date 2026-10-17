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

## Member 3: distribution and publishing integration

Until the download contract is agreed, app actions open an explicit GitHub Releases page when supplied, otherwise the official developer website. Users select the installer there. These actions do not claim to complete a download or installation.

An optional adapter is implemented in `components/app-details.tsx`. Once confirmed, set `DISTRIBUTION_DOWNLOAD_URL` to a **public browser-accessible** endpoint template containing `{slug}`. The client adds a `platform` query parameter and expects `{ "platform": "windows", "url": "https://...", "label": "..." }` (`DownloadOption`). The URL must contain no secrets. Cross-origin endpoints must allow the marketplace origin. Failed lookups, missing URLs, mismatched platforms, timeouts, and unsupported devices are handled. Device selection is manual.

Installer selection, architecture detection, security checks, release ingestion, and persistence remain Member 3’s responsibility. Publishing links currently go to `/about#developers`, which clearly states the portal is unavailable in this preview. Replace them with the agreed portal route when ready; reuse the shell, tokens, form fields, and Button component. No GitHub OAuth or duplicate publishing backend is implemented.

## Validation and limits

Production build, TypeScript, and ESLint pass. Playwright covers global/developer search, category/platform/license filters, reset, sorting, grid/list views, keyboard search, screenshot next/previous, unsupported devices, GitHub Releases fallback, missing screenshots/apps, legacy route, sticky shell, image loading, and horizontal overflow at 1440, 1024, 768, and 390 pixels. Captures and a QA record are under `.impeccable/review/`.

Live catalog/distribution APIs and the publishing portal remain integration tasks. Loading and retry components are implemented; no live-backend outage simulation was performed. The full dependency audit retains development-only findings through ESLint’s glob/micromatch/braces chain; the prior production audit reported no vulnerabilities.
