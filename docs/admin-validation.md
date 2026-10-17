# Admin review verification — 17 October 2026

Branch: `member-3/admin-review`.

## Automated checks

- `npm test`: 41 checks passed, including the real PGlite migration chain, selected-installer approval, withdrawal/resubmission version conflicts, repeated approval, update isolation, reviewer attribution, atomic rollback on attribution failure, wrapper grants and owner RLS.
- Admin server tests execute the actual service and route code with only session/database boundaries replaced. They verify authorization before privileged client creation, private no-store responses, strict approval input, server-derived reviewer identity, submitted-name/context mapping and migration/conflict errors.
- `npm run typecheck` and `npm run lint`: passed.
- `npm run build -- --webpack`: passed.
- `npm run test:browser`: 10 scenarios passed, including three admin scenarios for permissions, approval success/failure, keyboard interaction, duplicate-click protection, stale-version recovery, and layout overflow at 390, 768 and 1440 pixels. These are explicit API fixtures, not hosted authentication or database writes.

Node 24 was used. The browser suite requires local server/browser permission outside the sandbox. The installed compatible Chromium was selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; the default Playwright browser version was not installed.

Queue/detail captures are stored under `.impeccable/review/member3/admin-{queue,detail}-{390,768,1440}.png` (ignored review artifacts). An independent Impeccable finish review inspected all six captures and returned **ship**, with no material UI findings. No automated design detector ran because the local Impeccable engine was unavailable. Captures use fixture content without submitted screenshots; live third-party image behavior remains a hosted acceptance check.

## Hosted readiness

A fresh read-only probe of the configured Supabase project returned **404 PGRST205** for `application_revisions`. No database URL or Supabase management access token is configured for applying migrations from this workspace. No hosted schema, administrator allowlist or listing was changed.

Apply the migrations in filename order, configure server-only `ADMIN_USER_IDS`, and restart/redeploy. See [backend setup](backend-setup.md#administrator-setup-and-routine-review). Then run the real developer submission → administrator review/approval → marketplace download journey. Hosted OAuth, RLS, reviewer attribution and real download selection remain unverified until that setup is complete.
