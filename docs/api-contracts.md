# Commons backend API contracts

All endpoints are served by the Next.js App Router under `/api`. JSON success bodies use a `data` property except for the health response and paginated browse response. Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Listing data is invalid.",
    "details": []
  }
}
```

Error details appear only for request validation. Responses do not include stack traces, OAuth tokens, service keys, or private moderation notes. Authenticated responses use `Cache-Control: no-store`.

## Public marketplace

### `GET /api/health`

Checks a real Supabase query. `200`: `{ "status": "ok", "database": "ok" }`. Returns `503` when Supabase is unconfigured or unavailable.

### `GET /api/apps`

Public; only `published` rows are returned.

Query parameters:

| Name | Values | Default |
| --- | --- | --- |
| `q` | name, summary, description, and publisher name/username search, up to 100 characters | none |
| `category` | category name or slug | none |
| `platform` | `windows`, `macos`, `linux`, `web`, `android`, `ios` | none |
| `sort` | `featured`, `recent`, `updated`, `name` | `featured` |
| `page` | positive integer | `1` |
| `limit` | integer from `1` to `50` | `20` |

Response: `{ "data": ApplicationSummary[], "pagination": { "page", "limit", "total", "totalPages" } }`. Sort ties are deterministically ordered by application id. Relevance is not fabricated; `featured` prioritizes the moderator-set flag then publication recency.

### `GET /api/apps/{slug}`

Public, published listings only. Returns `{ "data": ApplicationDetail }` including developer attribution, categories, screenshot URLs and alt text, release history, assets, platform data, repository URL, and licence. Returns the same `404 NOT_FOUND` for a missing or unpublished slug.

### `GET /api/categories`

Public. Returns `{ "data": Category[] }` with counts based on publicly readable application-category links.

### `GET /api/apps/{slug}/download?platform=windows[&architecture=x64]`

Public, published listings only. Resolves a validated stored asset and returns `{ "data": { "platform", "url", "label" } }`; it never proxies binaries. A web listing returns its canonical HTTPS web URL. If multiple assets exist, or the only candidate has unknown architecture, callers must present a choice and retry with an architecture. Invalid platform is `422`, unavailable assets are `404`, and ambiguity is `409 ASSET_SELECTION_REQUIRED`.

### `POST /api/apps/{id}/reports`

Requires a signed-in GitHub user. Body: `{ "reason": "malware|impersonation|license|broken|other", "details": "optional text" }`. Reports are private; one report per user and application is enforced by the database. Success is `201`. No reporter identity is exposed through public routes.

## Authentication and developer operations

### `GET /api/auth/github?next=/optional/path`

Starts Supabase Auth's GitHub OAuth flow. `next` must be a same-site relative path; external redirects are discarded.

### `GET /api/auth/callback?code=...`

Exchanges the authorization code for a cookie-backed Supabase session. Missing/failed codes redirect to `/?auth=failed`.

### `POST /api/auth/logout` and `GET /api/auth/me`

Logout clears the Supabase session. `/me` returns the authenticated user id and verified GitHub username, never provider tokens.

### `GET /api/developer/profile`, `PATCH /api/developer/profile`

Requires authentication and a GitHub identity. `GET` creates the server-managed profile if missing. `PATCH` accepts only `displayName`, `biography`, and `avatarUrl`. User id and GitHub username always come from the verified session; provider tokens are never stored in the profile.

### `GET /api/developer/repositories/verify?repository=owner/repo`

Requires a GitHub OAuth session with `public_repo` scope and write/maintain/admin permission on the public, non-archived repository. Returns canonical repository metadata and stable releases/assets fetched server-side from GitHub. It does not publish or save a listing.

### `GET /api/developer/import?repository=owner/repo`

Existing unauthenticated portal preview. It imports public GitHub metadata only and does **not** verify publisher ownership. Use `/api/developer/repositories/verify` before persistence or publication.

### `POST /api/apps`

Requires authentication, a provider token, repository write access, a matching GitHub identity, and the server-only Supabase service-role key. The server re-fetches the repository, releases, and assets; client repository IDs, URLs, publisher IDs, ownership, and status are not trusted.

Request (screenshots can be HTTPS URL strings or `{ "url": "https://...", "alt": "..." }` objects):

```json
{
  "repository": "owner/repo",
  "name": "Example",
  "summary": "A short description",
  "description": "What the application does",
  "category": "Utilities",
  "screenshots": ["https://images.example/screenshot.png"],
  "iconUrl": "https://images.example/icon.png",
  "websiteUrl": "https://example.com",
  "webUrl": "",
  "releaseId": 12345,
  "assets": [{ "id": 67890, "platform": "windows", "architecture": "x64" }]
}
```

All listing fields are validated. The server derives publisher identity, GitHub repository ID, licence, release versions, canonical release URLs, and asset data. Asset IDs must occur in the selected stable release and match the server's conservative classifier. Success is `201` with a persisted `draft`. Duplicate repository or slug is `409`.

The `201` response contains `{ "data": { "id", "slug", "status": "draft", "name", "summary", "description", "iconUrl", "repositoryUrl", "category", "screenshots", "createdAt", "updatedAt" } }`.

### `PATCH /api/apps/{id}`

Requires authentication and ownership. Accepts only `name`, `summary`, `description`, `category`, `screenshots`, `iconUrl`, `websiteUrl`, and `webUrl`. It cannot set publisher, repository identity, status, featured flag, publication date, releases, or download URLs. A pending-review edit first returns the listing to draft so it must be resubmitted; submitted child release data is locked until then.

### `POST /api/apps/{id}/publish`

Requires authentication, ownership, current repository write access, a GitHub-identified SPDX licence, and a server-revalidated stable release with a supported installer or HTTPS web URL. A missing or `NOASSERTION` licence prevents submission. The trusted server refreshes stored release data and locks the listing while submitting it as `pending_review` (`202`); it does **not** make the listing public. Listings appear publicly only after a trusted moderator changes the status to `published`.

## Authorization and status codes

The server derives all identities from `auth.getUser()`. Repository verification also requires the server-side provider token and GitHub write permission. Supabase RLS filters private drafts and children; a trigger blocks direct writes to moderation fields. Only a trusted Supabase database operator/service-role operation can mark a listing `published`, `rejected`, or `suspended`, or feature it.

Common statuses: `400` malformed id/JSON, `401` unauthenticated, `403` insufficient permission, `404` absent/private listing, `409` conflict/state ambiguity, `413` body too large, `422` validation, `429` GitHub rate limit, `502` upstream failure, `503` database/configuration unavailable, `504` upstream timeout.

## TypeScript contracts

Database row types are in `src/types/database.types.ts` (handwritten schema mirror pending Supabase CLI type generation). Public API/domain types are separate in `src/types/api.ts`. Request parsing uses server-side Zod schemas in `lib/backend/validation.ts`.
