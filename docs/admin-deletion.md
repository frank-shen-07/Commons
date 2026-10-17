# Admin application deletion

The `/admin` page includes **Delete application**, available to the same server-configured administrators as approval. Paste a URL from the current site's `/apps/{slug}` route, select **Find application**, inspect the identity, publisher, repository and status, then type the exact slug and select **Permanently delete**.

This permanently deletes the database application and its related revisions, screenshots, release versions, installer metadata, category links and reports. Publisher accounts and shared categories remain. GitHub repositories, GitHub-hosted binaries, external images and already-downloaded files are not deleted. There is no restore operation or permanent block against a publisher submitting the repository again.

Changing the URL clears the preview and confirmation. Any failed deletion requires a fresh lookup before another attempt; requests are never retried automatically. Following a timeout, lookup determines whether the previous request committed. Deletion success is displayed only after the database confirms the exact application ID and slug.

## Database setup

Apply `supabase/migrations/202610180004_admin_delete.sql` after migrations 001, 002 and 003 through the team's authorised Supabase workflow. It adds the transactional, service-role-only `admin_delete_application(uuid,text,timestamptz)` function. It locks the application first and verifies the preview's slug and exact update timestamp before deleting. Existing foreign-key cascades perform child deletion atomically; no RLS policies are changed.

Check readiness in SQL Editor:

```sql
select to_regprocedure('public.admin_delete_application(uuid,text,timestamptz)');
```

After applying the migration, refresh the API schema:

```sql
notify pgrst, 'reload schema';
```

The marketplace must use the live database API through `MARKETPLACE_API_URL`. Sample-only catalogue entries are not database records and cannot be removed through this portal. Catalogue, detail and category APIs now return `Cache-Control: no-store`; deletion also revalidates affected pages. Fresh requests reflect deletion, while previously open pages and responses cached before deployment cannot be recalled.

## Private API contracts

- `POST /api/admin/applications/lookup` accepts `{url}` and returns `{data: {id, slug, name, status, repositoryUrl, publisher, updatedAt}}`. Application URLs must match the configured public `APP_URL` origin, rather than Next.js's internal listener/proxy hostname; no supplied URL is fetched. Query strings, fragments, credentials and extra path segments are rejected.
- `DELETE /api/admin/applications/{id}` accepts `{confirmSlug, expectedUpdatedAt}` and returns `{data: {id, slug, deleted: true}}`. The timestamp is preserved as the original database string, including fractional precision.
- Authorization runs before privileged database access. All responses are `no-store`. Errors use the existing envelope: 401 signed out, 403 non-admin, 422 invalid input, 404 absent application, 409 `STALE_APPLICATION`, and 503 for a missing migration.

## Verification and live-test boundary

Verification on 18 October 2026, branch `member-3/admin-delete`: `npm test` passed **47 checks**; `npm run test:browser` passed **12 scenarios**; typecheck, lint, and `npm run build -- --webpack` passed. Responsive captures are under `.impeccable/review/member3/admin-delete-{390,768,1440}.png` (ignored artifacts). Independent Impeccable finish review returned **ship** with no material UI findings. No automated design detector ran because its engine was unavailable.


The local database suite exercises all four migrations, full cascade deletion, rollback on a forced child-delete failure, service-role execution, denied ordinary roles, stale previews, repeated deletion and preservation of unrelated applications, publishers and categories. Server tests verify URL/body validation, authorization before privileged access, exact target parameters, timestamp precision and error envelopes. Browser fixtures exercise typed confirmation, duplicate clicks, queue cleanup, explicit recovery, keyboard interaction and responsive layouts at 390, 768 and 1440 pixels.

**OBS must remain untouched. The only permitted destructive live test is `/apps/skyblockhack`.** Before any live deletion, assert the lookup returned exactly `slug === "skyblockhack"`, then use that returned ID, slug and timestamp. Afterwards verify its detail/download routes return 404, catalogue/search no longer contain it, and OBS remains available using read-only checks. Never use OBS as a destructive test fixture.

Hosted migration application and live deletion were not performed: the configured direct PostgreSQL hostname still fails connection resolution with `ENOTFOUND`. Use the authorised Supabase SQL workflow or configure a working session-pooler connection before live verification.
