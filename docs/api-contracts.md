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

Validation errors include field issues; installer ambiguity includes public installer choices. Responses do not include stack traces, OAuth tokens, service keys, or private moderation notes. Authenticated responses use `Cache-Control: no-store`.

## Public marketplace

### `GET /api/health`

Checks a real Supabase query. `200`: `{ "status": "ok", "database": "ok" }`. Returns `503` when Supabase is unconfigured or unavailable.

### `GET /api/apps`

Public; only `published` rows are returned.

Query parameters:

| Name       | Values                                                                               | Default    |
| ---------- | ------------------------------------------------------------------------------------ | ---------- |
| `q`        | name, summary, description, and publisher name/username search, up to 100 characters | none       |
| `category` | category name or slug                                                                | none       |
| `platform` | `windows`, `macos`, `linux`, `web`, `android`, `ios`                                 | none       |
| `sort`     | `featured`, `recent`, `updated`, `name`                                              | `featured` |
| `page`     | positive integer                                                                     | `1`        |
| `limit`    | integer from `1` to `50`                                                             | `20`       |

Response: `{ "data": ApplicationSummary[], "pagination": { "page", "limit", "total", "totalPages" } }`. Sort ties are deterministically ordered by application id. Relevance is not fabricated; `featured` prioritizes the moderator-set flag then publication recency.

### `GET /api/apps/{slug}`

Public, published listings only. Returns `{ "data": ApplicationDetail }` including developer attribution, categories, screenshot URLs and alt text, release history, assets, platform data, repository URL, and licence. Returns the same `404 NOT_FOUND` for a missing or unpublished slug.

### `GET /api/categories`

Public. Returns `{ "data": Category[] }` with counts based on publicly readable application-category links.

### `GET /api/apps/{slug}/download?platform=windows[&architecture=x64][&assetId=<uuid>]`

Public, published listings only. Resolves the approved release/asset selection and returns `{data: {platform,url,label,architecture?,format?,instructions?}}`. Web apps return an approved HTTPS launch URL. Invalid platform/architecture/asset ID is `422`; missing apps/assets are `404`.

When several candidates remain (even sharing an architecture), or architecture is unknown without an explicit asset choice, returns `409 ASSET_SELECTION_REQUIRED` with `error.details: [{assetId,fileName,architecture,sizeBytes,format}]`. Retry with an exact stored asset ID. The UI requires acknowledgement for unknown architecture. IDs outside the selected published release/platform cannot resolve.

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

### Developer listings and revisions

Authenticated `GET /api/developer/apps` returns owned listing summaries; `GET /api/developer/apps/{id}` returns a `DeveloperListing` with editable snapshot, application status, revision status, revision ID and current version. Other publishers receive `404`. Responses never include provider tokens or private moderator notes.

`POST /api/apps` accepts the existing `PublishingRequest` fields: repository, name, summary, description, category, screenshots, optional icon/website/web URLs, selected GitHub release ID, and selected asset IDs/platforms/architectures. The server verifies repository access, reconstructs canonical metadata and validates the chosen assets. Success is `201` with a `DeveloperListing`. Duplicate repositories are `409`.

`PUT /api/developer/apps/{id}/draft` accepts `{input: PublishingRequest, expectedVersion: number}`. A stale version returns `409 STALE_DRAFT`. Complete listing input and the exact selection are saved atomically. A published app keeps its public fields while its draft revision changes. Pending submissions are locked.

`POST /api/developer/apps/{id}/submit` accepts `{expectedVersion: number}`. The server rechecks repository control, licence and the exact selected stable release/installers (or web URL), then returns `202` and the updated `DeveloperListing`. `revisionStatus` becomes `pending_review`; the application becomes `pending_review` only for a first publication. A published app remains published during update review.

`POST /api/developer/apps/{id}/draft/reopen` accepts `{expectedVersion: number}` and explicitly returns a pending revision to draft. This also withdraws an initial submission from pending review, while a published application remains available.

Existing `PATCH /api/apps/{id}` still accepts permitted metadata fields and preserves omitted fields, but delegates to revision persistence. Legacy `POST /api/apps/{id}/publish` delegates to the same submission service. New clients should use the versioned private endpoints to protect against concurrent edits.

Only a trusted moderator/database operator may run `approve_application_revision(revisionId)`. This transaction applies the reviewed snapshot and selected distribution data. A submitted revision is not a published listing; ordinary users cannot promote or approve it.

See [member-3-contracts.md](./member-3-contracts.md) for the full state flow, compatibility notes, and rollout requirements.

## Authorization and status codes

The server derives all identities from `auth.getUser()`. Repository verification also requires the server-side provider token and GitHub write permission. Supabase RLS filters private drafts and children; a trigger blocks direct writes to moderation fields. Only a trusted Supabase database operator/service-role operation can mark a listing `published`, `rejected`, or `suspended`, or feature it.

Common statuses: `400` malformed id/JSON, `401` unauthenticated, `403` insufficient permission, `404` absent/private listing, `409` conflict/state ambiguity, `413` body too large, `422` validation, `429` GitHub rate limit, `502` upstream failure, `503` database/configuration unavailable, `504` upstream timeout.

## TypeScript contracts

Database row types are in `src/types/database.types.ts` (handwritten schema mirror pending Supabase CLI type generation). Public API/domain types are separate in `src/types/api.ts`. Request parsing uses server-side Zod schemas in `lib/backend/validation.ts`.
