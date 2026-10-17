# Member 3 integration handoff

## Implemented journey

`/developer` displays account listings and separate local recovery drafts. `/developer/publish` imports a public repository, configures selected assets, previews and submits. `/developer/apps/{id}/edit` loads an account listing; `?local=1` opens a browser-local recovery draft with that ID. Local imports into an account require an explicit save.

Sign-in, identity, provider tokens, repository permissions, and persistence reuse Member 2's server services. No browser Supabase client or provider-token storage was added. The public metadata import remains preview-only.

## Private API contracts

Successes use `{data: ...}`; failures use the existing structured error envelope. All private responses are `no-store`.

| Method | Route                                 | Behaviour                                                                                   |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET    | /api/developer/apps                   | Current publisher's listing summaries, application/revision status and version              |
| GET    | /api/developer/apps/{id}              | Owned listing, editable snapshot and current version; other owners receive 404              |
| POST   | /api/apps                             | Create a saved draft from `PublishingRequest`; server re-verifies repository and asset data |
| PUT    | /api/developer/apps/{id}/draft        | Save `{input: PublishingRequest, expectedVersion: number}` transactionally                  |
| POST   | /api/developer/apps/{id}/submit       | Submit `{expectedVersion: number}` after fresh GitHub/licence/selection checks; returns 202 |
| POST   | /api/developer/apps/{id}/draft/reopen | Explicitly withdraw pending review into a draft using `{expectedVersion}`                   |

A `DeveloperListing` includes stable application ID/slug, status, revisionStatus, revisionId, version, updatedAt, and snapshot `{input, repository, categoryId}`. Root listing fields remain available for compatibility. Schema types live in `src/types/api.ts`; runtime validation remains server-side Zod. The portal handles stale versions with 409 `STALE_DRAFT`, keeps unsaved values, and offers export/reload.

`GET /api/developer/repositories/verify` returns full imported metadata and classified stable releases under `data`, with the nested `repository` property retained for previous callers. Optional README failures do not invalidate successful repository verification.

Existing `PATCH /api/apps/{id}` now saves a revision using the same service and retains omitted fields. A pending submission must first be explicitly reopened. It cannot change identity, slug, moderation state, or external distribution URLs. Legacy `POST /api/apps/{id}/publish` delegates to revision submission; callers should use the versioned submit route for conflict protection.

## Persistence and review

Apply the additive `202610170002_publisher_revisions.sql` migration after the original migration. Private revisions hold validated input and server-fetched repository/release snapshots. Only one draft/pending revision is active per app; prior approved/rejected revisions remain in history. Owner RLS permits reads, while only trusted server functions can save or change review state. The functions enforce expected versions under a database row lock.

New app status: draft → pending_review → published. Published updates change only the private revision until approval; their public row stays published. A pending revision can return to draft. Rejected revisions can be replaced with a new draft. Suspended applications cannot be edited or submitted through these operations.

Approval atomically applies the submitted metadata, category, screenshots, selected release, and selected installers; unselected files never become public downloads. The public version data represents the approved distribution; older full snapshots remain in revision history. Existing published rows retain their stored distribution until a reviewed update. Legacy draft selections cannot be reconstructed, so their next submission requires explicit reconfirmation.

The protected `/admin` portal now provides routine review for server-configured administrators (`ADMIN_USER_IDS`), using version-checked atomic approval and reviewer attribution. See the backend setup guide. A trusted operator can still inspect `application_revisions.snapshot` and runs:

```sql
select public.approve_application_revision('<reviewed-revision-uuid>');
```

Only the database operator or service role may execute approval. Directly changing `applications.status` does not apply a revision and must not be used for new submissions.

## Marketplace downloads

`GET /api/apps/{slug}/download?platform=windows[&architecture=x64][&assetId=<stored-asset-uuid>]` returns `{data: {platform,url,label,architecture,format,instructions}}` for one approved installer. Web apps return their approved HTTPS URL. New listings restrict resolution to the stored approved release/asset selection. Legacy records resolve only their newest stored release, consistently with public compatibility metadata.

Ambiguity, including multiple installers sharing one architecture, returns 409 `ASSET_SELECTION_REQUIRED` with `error.details: [{assetId,fileName,architecture,sizeBytes,format}]`. The UI asks for an exact choice. An unknown architecture never auto-selects; the UI requires acknowledgement. An explicit asset ID must still match the published application, platform and optional architecture.

Local live app pages default to the same-origin resolver. External `DISTRIBUTION_DOWNLOAD_URL` overrides must implement this envelope and selection contract. Sample listings retain their official release/developer fallback. Local-preview redirects remain separate and must not be substituted for the JSON resolver.

## Validation and hosted setup

See `docs/member-3-validation.md` for coverage and limits. The configured project did not contain `application_revisions` when probed; migrations were tested locally but not applied to a hosted project. Hosted OAuth/provider-token behavior and the final real release journey still need verification after setup.
