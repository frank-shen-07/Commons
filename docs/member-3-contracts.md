# Member 3 integration handoff

## Current scope

The developer portal UI remains a local-draft workflow. The backend now provides Supabase OAuth/session, repository verification, persistent listing APIs, moderation submission, and published download resolution. The portal UI has not yet been connected to those protected APIs. Public metadata import and release previews continue to use real GitHub API requests. Drafts are stored only on the current browser/device, under `commons.publisher.drafts.v1`.

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

## Member 2 integration APIs

Use [docs/api-contracts.md](./api-contracts.md) for full schemas and error formats and [docs/backend-setup.md](./backend-setup.md) for OAuth/project configuration.

1. Sign in through `GET /api/auth/github`; the callback establishes an HttpOnly Supabase session.
2. Verify repository access with `GET /api/developer/repositories/verify?repository=owner/repo`. The public import endpoint is preview-only and does not prove ownership.
3. Submit a listing through `POST /api/apps`. The backend re-fetches repository/releases/assets, validates all input, and persists a draft. Do not send a publisher ID or token.
4. Update allowed listing fields through `PATCH /api/apps/{id}`. Updating a pending-review listing returns it to draft so it must be re-submitted.
5. Submit through `POST /api/apps/{id}/publish`. This verifies GitHub access and current releases again, refreshes stored metadata, and returns `pending_review`; it does not make the app public.

The portal currently stores its form only in browser storage and does not call these routes. Connecting its UI requires an authenticated session flow and a server-held cookie; JSON draft exports remain untrusted input, not proof of ownership.

## Member 1 integration work

The portal links are connected to `/developer`. The consumer adapter in `lib/api.ts` unwraps the public API and maps it to `MarketplaceApp` from `lib/types.ts`. `GET /api/apps/{slug}/download?platform=...` returns `{platform, url, label}` for published asset records. If multiple candidates or unknown architecture prevent an unambiguous result, the API returns `409 ASSET_SELECTION_REQUIRED`; callers must let the user choose instead of silently selecting.

Do not connect the current draft redirect to `DISTRIBUTION_DOWNLOAD_URL`: it returns HTTP 302 rather than the JSON response expected by the consumer adapter.

## Validation and remaining checks

`node --test tests/publishing.test.mjs` (Node 24): classification, archives/debug exclusions, URL validation, official asset destinations, installation guidance.

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass in this workspace. Live OAuth, database/RLS integration tests, and the protected GitHub repository journey still require configured Supabase/GitHub credentials. In a browser, the portal's local-draft flow can be checked independently; UI-to-API publication wiring remains outstanding.

A real publication journey remains contingent on configuring Supabase/GitHub and connecting the portal UI. The UI explicitly marks local drafts unpublished. No installed-app state is recorded.

## Reference documentation

- [GitHub release asset API](https://docs.github.com/en/rest/releases/assets)
- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [GitHub OAuth flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
