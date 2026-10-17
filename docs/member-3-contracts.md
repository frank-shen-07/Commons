# Member 3 integration handoff

## Current scope

Branch: `member-3/developer-portal`. Member 2 dependencies are deliberately deferred. There is no OAuth, session implementation, database adapter, or simulated publication. Public metadata import and release downloads use real GitHub API requests. Drafts are stored only on the current browser/device, under `commons.publisher.drafts.v1`.

## Owned files

- `app/developer/**`: routes, scoped styling.
- `components/developer/**`: dashboard and wizard.
- `lib/publishing/**`: draft, repository, release and asset contracts/services.
- `app/api/developer/import/route.ts`: public repository import.
- `app/api/developer/download/route.ts`: validated preview download redirect.
- `tests/publishing.test.mjs`: dependency-free distribution checks.

Small shared changes connect developer links and allow external screenshot previews without server-side image proxying. Existing consumer catalog APIs are unchanged.

## Contracts implemented now

Shared models: `lib/publishing/types.ts`.

### GET /api/developer/import?repository=owner/repo

Returns `RepositoryImport`: repository ID, canonical full name, description, owner, avatar, licence, README text, stable releases and classified assets. Accepts an owner/repo or HTTPS GitHub repository URL. Public, non-archived repositories only. Reads the first 20 release records; no pagination yet. Source archives are never installer options. README is optional, displayed as plain text; metadata and release failures surface as errors.

### GET /api/developer/download

Required query parameters: `repository`, `releaseId`, `assetId`, `platform`. Re-fetches a stable release from GitHub, verifies asset membership and supported format/platform, then returns HTTP 302 to its canonical GitHub release asset URL. Arbitrary destinations are never accepted. Failures return JSON `{error: string}` with a non-2xx status. This is a preview download, not a published listing endpoint.

## Member 2 integration work

Before exposing public publication:

1. Provide a session-backed GitHub OAuth service with protected server-side credentials.
2. Add a server session adapter; never accept publisher identity or tokens from draft exports.
3. Re-fetch the repository with the publisher token and verify write/maintainer permissions at import and publication.
4. Validate all listing input server-side. Browser validation is for draft usability only.
5. Re-fetch selected releases/assets; verify repository identity, asset ownership, stable status and compatibility. Never trust stored draft classification or URLs.
6. Validate the open-source licence before approval; a missing or ambiguous licence must not imply open-source verification.
7. Persist separate draft and published snapshots, selected immutable GitHub IDs, and publisher identity. Enforce ownership on every read/write. Publishing should atomically update the public snapshot.
8. Preserve the prior public version while editing a draft. Reserve stable, unique slugs.

Proposed routes for agreement:

| Method | Route | Response |
| --- | --- | --- |
| GET | /api/developer/apps | Owned listing summaries |
| POST | /api/developer/apps | Validated persisted draft |
| GET/PATCH | /api/developer/apps/:id | Owned draft and public status |
| POST | /api/developer/apps/:id/refresh | Refreshed releases, preserve edited listing fields |
| POST | /api/developer/apps/:id/publish | Published marketplace slug |

Use `ListingInput` as the starting request contract, with runtime validation at the backend. JSON exports are a handoff artifact, not an authenticated publication request.

## Member 1 integration work

The portal links are connected to `/developer`. Reuse public `MarketplaceApp` from `lib/types.ts` after backend publication. Add a listing resolver that returns `{platform, url, label}` to match the existing `DownloadOption` contract. Its URL should target an internal endpoint that resolves stored published asset IDs; include architecture/format/instructions as optional enrichment. If architecture is ambiguous, require explicit selection instead of choosing silently.

Do not connect the current draft redirect to `DISTRIBUTION_DOWNLOAD_URL`: it returns HTTP 302 rather than the JSON response the consumer adapter expects.

## Validation and remaining checks

`node --test tests/publishing.test.mjs` (Node 24): classification, archives/debug exclusions, URL validation, official asset destinations, installation guidance.

After installing dependencies: `npm run typecheck`, `npm run lint`, `npm run build`. In a browser, import a public release repository, edit a description and screenshot URLs, select stable installers, save/reopen a draft, preview platform choices, request an installer, export JSON, and delete the draft. Also check source-only repositories, no licence, missing releases, rate limiting, storage denial, invalid URLs, and mobile layout.

A real publication journey remains contingent on Member 2's integration; the current UI explicitly marks drafts unpublished. No installed-app state is recorded.

## Reference documentation

- [GitHub release asset API](https://docs.github.com/en/rest/releases/assets)
- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [GitHub OAuth flow for the deferred authentication integration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
