# Changelog

## Hosting-readiness fixes (2026-11-07)

- PostgreSQL startup crash fixed: the column check compared `FatherName` with PostgreSQL's lower-case `fathername`, so the app tried to add an existing column and exited (`42701 column "fathername" ... already exists`). The check is now case-insensitive and the ALTER uses `IF NOT EXISTS`. The converted schema and all main queries were run against a real PostgreSQL 16 server.
- Dockerfile installs `libgssapi-krb5-2` (Npgsql logged `Cannot load library libgssapi_krb5.so.2`).
- Dockerfile: removed `groupadd`/`useradd` for `app`. The official .NET images already contain that user, so the old lines would fail the Docker build. The image now reuses the existing `app` user.
- `/healthz` no longer touches the database and is exempt from the HTTPS-only check, so hosting health checks pass even without `X-Forwarded-Proto`. Use `/healthz/db` for a manual database check.
- Admin dashboard: the CSRF token is refreshed after sign-in and cleared after sign-out. Before, the first status/payment change after logging in could fail with "Refresh the page and try again."
- Public submit: a double tap that races on the unique submission token is retried once instead of returning an unhandled error.
- Admin search: `%`, `_` and `\` typed in the search box are now matched literally on SQLite as well as PostgreSQL.
- `global.json`: now accepts any installed .NET 10 SDK (`10.0.100`, `latestFeature`) instead of requiring 10.0.4xx exactly.

## Paper-form page and student photos

- `wwwroot/index.html` — replaced the marketing landing page with the admission form, laid out like the paper form (photo box, fee box, rules panel). Course catalogue, payment-explainer and contact sections were removed; the status check is a collapsed section at the bottom.
- `wwwroot/form.css` — new stylesheet for that page. `site.css` is kept because the admin pages use it.
- `wwwroot/apply.js` — new script: course and fee box, photo picker with crop and compression, review dialog, submit, print, status check. Replaces `site.js` (deleted).
- `wwwroot/admission-print.js` — print layout now matches the paper form and includes the student's photo; the paper-size and Print buttons are wired from the opener because the page's content security policy blocks inline scripts in the preview window.
- `wwwroot/admin.html`, `wwwroot/admin.js`, `wwwroot/admin.css` — student photo in the record dialog; gender, municipality, district and province are optional in the edit form.
- `Models/AdmissionModels.cs` — added `PhotoData`; made gender, municipality, district, province and emergency-contact fields optional.
- `Data/AdmissionStore.cs` — new `StudentPhotos` table (created on startup, safe for existing databases), photo validation (`TryParsePhoto`), photo read (`GetPhoto`), null-safe optional fields.
- `Data/schema.sql` — documented the `StudentPhotos` table.
- `Program.cs` — admin-only photo endpoint, photo and optional-field validation, public submit limit raised from 8 to 40 per 10 minutes.

## Earlier changes

- `.gitignore` — excluded build outputs, local databases, key rings, and environment secrets.
- `.dockerignore` — excluded build outputs, backups, videos, local data, and secrets from Docker context.
- `AdmissionWeb.csproj` — added Npgsql for PostgreSQL persistence.
- `ButwalAdmission.sln` — updated the project reference for the flat repository layout.
- `Data/AdmissionStore.cs` — added provider selection, PostgreSQL schema compatibility, case-insensitive admin bootstrap, bounded pooling, and cross-provider inserts.
- `Data/DatabaseXmlRepository.cs` — added PostgreSQL-backed ASP.NET Data Protection key storage.
- `Data/schema.sql` — documented the SQLite Data Protection key table for local initialization.
- `DEPLOY_GUIDE.md` — added GitHub, Neon, Render, and restart-verification instructions.
- `Dockerfile` — added multi-stage .NET 10 container publishing, non-root runtime, and port 10000 configuration.
- `Program.cs` — added PostgreSQL/key-storage startup, admin bootstrap, CSRF validation, response compression, security headers, cache policy, and 404 fallback.
- `README.md` — updated root-layout build and production database instructions.
- `REVIEW_AND_REPAIR.md` — recorded audit findings, repairs, and verification limits.
- `wwwroot/admin.css` — formatted and restyled the admin dashboard with tokens, focus states, and mobile table scrolling.
- `wwwroot/assets/esewa-qr.jpg` — removed the older duplicate QR asset.
- `wwwroot/assets/esewa-qr.png` — added the supplied eSewa QR image without image processing.
- `wwwroot/favicon.svg` — added a favicon that embeds the unchanged logo asset.
- `wwwroot/index.html` — added QR payment guidance, QR dialog, conditional payment-step QR, and Open Graph metadata.
- `wwwroot/site.css` — formatted and extended the public design system with responsive sizing, glow, reduced-motion, and QR dialog styles.
- `wwwroot/site.js` — added QR dialog controls, conditional QR panel, scroll reveals, and mobile-menu state handling.
- `docs/screenshots/README.md` — documented the unavailable browser/screenshot checks.

`wwwroot/assets/butwal-skills-logo.png` was verified by SHA-256 and left byte-for-byte unchanged.
