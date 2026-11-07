# Butwal Skills Training Institute Online Admission

An ASP.NET Core online admissions site and administrator dashboard modeled on the institute's paper admission form. The public page (`/`) is the admission form itself, styled like the paper form: name, father's name, date of birth, address, qualification, contact number, class time, course, a passport-size photo, and a fee box (total, paid, remaining). The dashboard adds application search, payment-claim review, audit history, CSV export, and printable admission forms with the student's photo.

## Technology and versions

- ASP.NET Core / .NET target: `net10.0`.
- Required development SDK baseline: **.NET SDK 10.0.401** (`global.json` pins this baseline and allows later patches in the same feature band). This is the SDK used for the local Release build.
- Recommended current runtime: **ASP.NET Core Runtime 10.0.14 or a later .NET 10 servicing patch**. The supplied Dockerfile uses the official .NET 10 ASP.NET runtime image, so visitors do not install .NET on their devices.
- NuGet dependencies: `Microsoft.Data.Sqlite` 10.0.0, `SQLitePCLRaw.lib.e_sqlite3` 2.1.14, and `Npgsql` 10.0.0.
- Local database: SQLite. Production database: PostgreSQL through `DATABASE_URL`.

.NET 10 is an active LTS release, supported through November 14, 2028. Review Microsoft's support page and install the latest security updates when maintaining the deployment.

## Install the development SDK

1. Install the .NET 10 SDK from [Microsoft's .NET 10 download page](https://dotnet.microsoft.com/download/dotnet/10.0). On Windows, the x64 SDK is appropriate for most computers.
2. Open a new terminal and confirm `dotnet --version` reports `10.0.401` or a later patch accepted by `global.json`.
3. From this folder, run:

```powershell
dotnet restore ButwalAdmission.sln
dotnet build ButwalAdmission.sln -c Release
```

## Run locally

```powershell
dotnet run --project AdmissionWeb.csproj
```

Without `DATABASE_URL`, the application creates and uses `App_Data/admissions.db`. Set `ADMISSION_DB_PATH` to choose another local database file. ASP.NET Data Protection keys are stored alongside the database unless `ADMISSION_KEYS_PATH` is set. Keep both locations private and back them up together.

Create the first local administrator with the masked-password setup prompt:

```powershell
dotnet run --project AdmissionWeb.csproj -- --setup-admin
```

For hosted setup, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` as secret environment variables. The first account is created only if it does not already exist; a restart does not replace its password. Administrator accounts can also be created or reset from the authenticated dashboard. To reset your own account, use the server-side command:

```powershell
dotnet run --project AdmissionWeb.csproj -- --reset-admin your-admin-name
```

Administrator passwords must be 14–256 characters. Passwords are stored as salted PBKDF2-SHA256 hashes, not plaintext.

## Database setup and upgrades

The application uses parameterized SQL with SQLite locally and PostgreSQL in production; it does not use Entity Framework Core. The database schema is initialized at startup, and versioned, idempotent upgrades are recorded in `SchemaMigrations`. Current upgrades add the paper-form father and preferred-class-time fields and normalize old unverified placeholder fee amounts. Existing records are retained. `Data/schema.sql` is the standalone SQLite schema reference.

For durable online records, configure a managed PostgreSQL database and set its TLS-enabled PostgreSQL URL in `DATABASE_URL`. The production app stores applications, student details, payment claims, audit entries, administrator accounts, and Data Protection keys in PostgreSQL. Do not deploy with the default local SQLite path to a host with an ephemeral filesystem.

Back up the production database regularly and test restoring a backup to a separate database before relying on it. For PostgreSQL, use a secure `pg_dump`/restore workflow; the dashboard CSV is a convenient records export but is not a complete database backup. Do not put backup files, passwords, database URLs, or student records in the source ZIP or Git.

## Admissions, fees, and payment review

- Course and fee values are managed by an administrator. The server calculates the payable fee and rejects an initial payment claim above that fee.
- An amount entered by an applicant is a claim. Zero is recorded as **Unpaid**; a positive claim remains **Pending Verification** until an administrator checks it. A verified amount is reflected as paid on printed forms.
- eSewa merchant checkout and server-side transaction verification are not activated. The supplied eSewa QR and transaction reference support manual review only; the application never marks a payment successful from a browser message or screenshot.
- **Passport-size photo.** The applicant taps the photo box and chooses a picture from the gallery or camera. The browser crops it to 35:45 and compresses it to JPEG. The server accepts only real JPEG, PNG or WebP files of 400 KB or less (it checks the file's first bytes, not its name), stores the photo in the database table `StudentPhotos`, and serves it only to signed-in administrators at `/api/admin/applications/{id}/photo`. Older applications without a photo print an empty photo frame. Signature areas on printed forms stay blank.
- Only the paper-form fields are required. Gender, municipality, district, province and emergency-contact fields are optional now and are stored as empty text when not given. Existing records are not changed.
- The public submit limit is 40 applications per IP address per 10 minutes, so staff can enter walk-in students from one office network.

## Admin dashboard

Open `/admin.html` and sign in with a provisioned admin account. The authenticated dashboard supports application search/filtering, student detail edits, application and payment status changes, course/fee management, administrator creation/password reset, audit history, CSV export, and printing individual or selected admission forms.

Never expose the admin password or student database publicly. Use the deployment environment's secret store.

## Printing

The admission form includes the institute branding, the paper-form fields, the student's photo, the fee box, rules and regulations, and signature lines. A4 portrait is the default. The print preview supports A4 portrait/landscape, A5, Letter, Legal, and the printer's custom-size settings. The browser print dialog can print or save the form as PDF. Allow pop-ups for the site when opening a print preview.

## Deploy

See [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) for Render Docker + managed PostgreSQL deployment and persistence setup. This source package is prepared for deployment; no public hosting account or deployment credentials were available in this task, so it has **not** been deployed and no live URL is claimed.

See [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md) for the completed build, data-layer, script, and ZIP checks, plus the checks that could not be performed without hosting credentials or browser/network access.
