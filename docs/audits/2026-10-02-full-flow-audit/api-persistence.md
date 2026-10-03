# Disposable local API persistence verification — 2026-10-03

## Result

The current Prisma schema pushed to a new local PostgreSQL database. Direct Prisma and real service persistence checks passed.

- Client create, list, update, and agency-scoped duplicate-email rejection passed.
- Template create, default-template query, update, and delete passed.
- Access-request create, read, and status update from `pending` to `partial` passed.

The machine-readable result is [api-persistence.json](api-persistence.json).

The service result is [api-service-persistence.json](api-service-persistence.json).

- `client.service` created, searched, updated, and rejected a duplicate agency email with `CLIENT_EMAIL_EXISTS`.
- `template.service` created, updated, deleted, and enforced a single default template for the agency.
- `access-request.service` created a Google Ads request, transformed it on read, and updated it to `partial` with an external reference.

## Harness and commands

The harness is [run-api-persistence.sh](run-api-persistence.sh), [api-persistence-harness.mjs](api-persistence-harness.mjs), and [api-service-persistence-harness.ts](api-service-persistence-harness.ts).

It ran:

```sh
bash docs/audits/2026-10-02-full-flow-audit/run-api-persistence.sh
```

The script creates a `mktemp` PostgreSQL cluster, binds only `127.0.0.1:55439`, creates a new `authhub_persistence` database, and copies the current Prisma schema into the temporary directory. It runs `prisma db push` against that copy with a process-scoped local `DATABASE_URL`. It then runs the real service harness with `NODE_ENV=test`, workers disabled, and non-secret process-scoped placeholders for required configuration. It changes working directory to the temporary cluster before importing services, so `dotenv.config()` cannot find the repository `.env` file.

The first direct run pushed the schema but the harness could not resolve `@prisma/client` from the audit directory. The harness now resolves the API workspace package directly. The first service run found no API-local `tsx` binary. The runner now uses the repository binary. Moving the service harness to the audit directory exposed CommonJS top-level-await handling; the harness now uses an async runner. The final run passed. The post-run port check confirmed `55439` is closed. The trap stopped PostgreSQL and removed the temporary data directory.

## Boundaries

- The direct proof uses Prisma CRUD. The service proof exercises service validation, client duplicate policy, template default policy, and access-request transformation and update policy. It does not exercise registered HTTP routes or auth middleware.
- The access-request fixture requested Google only. It did not enter Meta recipient discovery. No providers, Infisical, Clerk, mail, or jobs were invoked. No external mocks were required.
- The local database was empty and disposable. No current environment database, production database, or secrets were read.
- This is persistence proof only. It is not browser, deployed API, Clerk, Infisical, provider, or production proof.
