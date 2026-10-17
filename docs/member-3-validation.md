# Member 3 verification — 17 October 2026

Branch: `member-3/publishing-integration`.

## Automated checks

- `npm test`: **35 passed**. Includes real embedded PostgreSQL execution of both migrations, private draft/revision isolation, optimistic conflicts, selected installer retention, review withdrawal, published-update isolation, transactional approval rollback, slug boundaries, and ordinary-user approval denial. PGlite supplies PostgreSQL and bundled extensions; the harness supplies Supabase's auth schema/roles/UID function locally.
- `npm run typecheck` and `npm run lint`: passed without errors or lint warnings.
- `npm run build -- --webpack`: production compilation, TypeScript, page generation and tracing passed. Default Turbopack hit a local CSS-worker port-binding error, including on retry outside the sandbox. The package's default compiler has not been changed.
- `npm run test:browser`: **7 browser scenarios** using explicit API fixtures. These verify browser behaviour and request shapes, not a real OAuth exchange or hosted database writes.

Browser coverage:

1. Verified import → selected installer → account save → preview → submit → return to draft.
2. Explicit local migration, another account's recovery draft hidden, stale-write input retention and export.
3. Published update submission retains public listing availability.
4. Exact consumer installer selection, unknown-architecture acknowledgement, requested download and installation guidance.
5. Repository permission denial preserves the entered repository.
6. Source-only repositories can configure a web application; a missing licence prevents submission.
7. Database unavailability is shown separately from an empty account catalogue.

Preview screenshots and horizontal-overflow checks cover 1440, 768 and 390 pixels. Final responsive captures are under `.impeccable/review/member3/` (ignored working artifacts). Rendered desktop and mobile previews were visually inspected.

The browser runner normally starts an isolated source copy on port 3103 and cleans it up. Install a browser with `npx playwright install chromium`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing compatible Chromium binary. `E2E_BASE_URL` can reuse a fixture-mode server configured with `DISTRIBUTION_DOWNLOAD_URL=/api/apps/{slug}/download`.

## Real read-only release verification

The public preview imported `obsproject/obs-studio` from GitHub successfully: HTTP 200, six stable releases and 27 eligible installer assets in the returned window. A selected installer was revalidated by the preview download route, which returned HTTP 302 to the canonical repository's HTTPS GitHub release URL. The binary was not downloaded or executed.

## Hosted rollout still required

A read-only REST probe of the configured Supabase project returned `404 PGRST205` for `application_revisions`. The new hosted migration was not applied. No database connection URL or Supabase management access token is configured for applying SQL from this workspace.

Apply `supabase/migrations/202610170002_publisher_revisions.sql` after the original schema. Then verify with a real GitHub publisher account:

1. Sign in, verify a public repository with write access, save and reopen a listing from another browser.
2. Submit, inspect the exact revision snapshot as a moderator, and call `approve_application_revision` for that reviewed revision.
3. Discover the public listing and request its selected installer through the marketplace resolver.
4. Prepare a new version, confirm the prior listing remains public through review, then approve and check the new selected download.

Provider-token behaviour, actual hosted RLS, and this authenticated journey are not claimed as verified by browser fixtures or local SQL tests. Review setup and SQL instructions are in `docs/backend-setup.md` and `docs/member-3-contracts.md`.
