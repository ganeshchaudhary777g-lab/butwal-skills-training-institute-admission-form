# Hosting and deployment guide

This project targets ASP.NET Core 10 and is packaged as a Linux Docker web service. Render provides a Docker runtime, public HTTPS routing, environment secrets, and health checks. Use a managed PostgreSQL database (the existing guide uses Neon) as the durable data store.

## Runtime compatibility

- Framework: .NET / ASP.NET Core `10.0` (`net10.0`). .NET 10 is LTS and currently supported through November 14, 2028.
- Development SDK baseline: `10.0.401`, pinned by `global.json`; later patches in the same feature band are allowed.
- Recommended runtime patch: ASP.NET Core Runtime `10.0.14` or later on the .NET 10 line. The Dockerfile uses the official `mcr.microsoft.com/dotnet/aspnet:10.0` image, which supplies the runtime inside the server container. Website visitors do not install .NET.
- Database: PostgreSQL over TLS in production; local SQLite is for development or a host with explicitly persistent storage.
- Hosting entrypoint: Render **Docker Web Service**, listening on port `10000`; health path `/healthz`.

.NET 10 is selected because the existing app already targets it; there is no framework upgrade. Check the [official .NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy) before each production maintenance cycle.

## Important plan and persistence notes

Do not use Render's Free Postgres for student records: Render documents that its free PostgreSQL instances expire after 30 days and do not include backups. Free web services sleep after inactivity and have an ephemeral filesystem. Render persistent disks are only available to paid web services. This project instead recommends an external managed PostgreSQL database so student records and ASP.NET Data Protection keys remain available through app restarts and redeploys. For production, select a database plan with an appropriate backup/recovery policy and a paid always-on web service if the site must not cold-start after idle time.

Render documents Docker web services and persistent disks in its [Docker guide](https://render.com/docs/docker), [free plan limitations](https://render.com/docs/free), and [persistent disk guide](https://render.com/docs/disks). Check current plan terms and prices before purchase. Neon plan limits and backup/restore options can also change; choose a tier with the retention and recovery protections the institute requires.

## 1. Prepare source control

1. Extract the supplied project ZIP.
2. Put the **contents** of its project folder at the root of a private GitHub repository so `AdmissionWeb.csproj` and `Dockerfile` are at the repository root.
3. Commit source and static assets. Do not commit `App_Data`, SQLite databases, key-ring XML files, `.env` files, database dumps, or real student records. The included `.gitignore` and `.dockerignore` exclude generated and private files.
4. Connect the repository to Render and create a **Web Service** using Docker. Set the root directory to the repository root and the Dockerfile to `Dockerfile`.

## 2. Create a PostgreSQL database

1. Create a managed PostgreSQL project in a region close to the web service.
2. Copy its PostgreSQL connection URL from the provider's connection dialog. Keep the URL secret; it contains database credentials.
3. Use a production plan appropriate for student information, with automated backups or a documented external backup procedure. Do not use Render Free Postgres for production student records because that plan expires after 30 days.

The application creates its tables at startup and applies versioned, idempotent schema upgrades. It does not use EF Core migrations. Back up first before deploying a schema update to a database that already contains records.

## 3. Configure Render

In the Render service **Environment** settings, add the following secrets/settings:

- `DATABASE_URL` — the PostgreSQL URL beginning with `postgresql://` or `postgres://`.
- `ADMIN_USERNAME` — initial account username (3–40 letters, digits, dot, underscore, or hyphen).
- `ADMIN_PASSWORD` — initial password, 14–256 characters; use a unique password and store it in a password manager.
- `TRUST_FORWARD_HEADERS` — set to `true` only when the app is behind Render's trusted reverse proxy, so ASP.NET receives the public HTTPS scheme and client address.
- `ASPNETCORE_FORWARDEDHEADERS_ENABLED` — the Dockerfile enables this for the container host.

Do not use `ADMISSION_DB_PATH` for Render production unless you attach and configure a paid persistent disk. With `DATABASE_URL`, the app uses PostgreSQL and stores Data Protection keys in the same database.

Set the health-check path to `/healthz` (it does not query the database, so it will not keep a sleeping database awake). Open `/healthz/db` yourself once after deploying to confirm the database connection works. The container binds to port `10000`. Configure a paid always-on web service for a production admissions site; the free web service can sleep and respond slowly on the next visit.

## 4. First deployment and administrator

1. Deploy the service and wait for Render to report a successful deploy.
2. Open the generated HTTPS `onrender.com` URL and verify the home page, logo, course catalogue, and `/healthz` response.
3. Open `/admin.html` and sign in with the initial account. On first startup, the account is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Changing those environment values later does not reset an existing account.
4. Create additional administrators from the authenticated **Administrator accounts** panel. To reset your own password, use the server-side `--reset-admin` command with a private interactive terminal or update the credential through the deployment's secure operations process.
5. Remove or rotate any temporary setup secrets after first use, without losing the credentials needed to operate the site.

## 5. Verify persistence and business flow before launch

Use fictional test data only:

1. Submit a test admission with a valid mobile number, course, and payment method.
2. Confirm the application number is shown and payment remains **Unpaid** or **Pending Verification**; it must not appear paid before an administrator verifies it.
3. Sign in as an administrator, locate the application, edit a test detail, review the audit log, and verify a payment only against the institute account/receipt.
4. Print one admission form and several selected records; check the desired paper size and use the browser's **Save as PDF** option for a PDF copy.
5. Restart or redeploy the service, then sign in again and confirm the test record remains. Confirm database backups can be restored to a separate database before real admissions begin.
6. Test the public page and form on a mobile browser and a real printer/PDF destination.
7. Delete the test record only through an explicitly protected, audited process if the institute later adds that capability; this application does not automatically delete admissions.

## 6. Backups and recovery

Student photos are stored in the same database (table `StudentPhotos`, about 40–90 KB each), so a database backup includes them. At that size, 1,000 students need roughly 100 MB. Check your database plan's storage limit.

Neon's Free plan is permanent, but its instant-restore history is only 6 hours, according to Neon's plans page. Do not rely on it as your only backup. Run `pg_dump` (below) on a schedule, for example weekly, and keep the files outside the project.

Use the database provider's backup feature and schedule regular encrypted exports. Example PostgreSQL backup command (run from a trusted machine with PostgreSQL client tools installed; it keeps the URL in the environment, not source):

```powershell
pg_dump --dbname="$env:DATABASE_URL" --format=custom --file="bsti-backup.dump"
```

Store exports outside the project, restrict access, and test restore into a separate database. The dashboard's CSV export is useful for a simple student-list copy but does not include accounts, payment/audit metadata, schema, or Data Protection keys, so it is not a complete recovery backup.

For local SQLite development, stop the app and back up both the SQLite database and the Data Protection `keys` directory. Do not copy local records into a production database without a reviewed migration and permission from the institute.

## 7. Live URL and payment integration

The source is deployment-ready, but it has not been deployed from this environment because no hosting account, PostgreSQL URL, or administrator credentials were provided. No live URL is available to report.

Live eSewa checkout and server-side merchant verification are also inactive because merchant credentials and integration approval were not provided. The site records payment claims for manual review and does not pretend that QR scans or browser messages are verified payments.

## 8. Common first-deploy errors

- **Deploy exits right after start:** `ADMIN_USERNAME` must be 3-40 letters/digits/`.`/`_`/`-`, and `ADMIN_PASSWORD` must be at least 14 characters. Otherwise the app stops at startup on purpose. Read the service log.
- **`Invalid URI` / database error at start:** `DATABASE_URL` must contain only the URL (`postgresql://user:password@host/dbname...`). Do not paste `psql '...'` or add quotes or spaces.
- **Build fails at `groupadd`:** you are using an old Dockerfile. Use the Dockerfile from this version.
- **`GitHub` repository layout:** `Dockerfile` and `AdmissionWeb.csproj` must be at the repository root, not inside an extra folder.
