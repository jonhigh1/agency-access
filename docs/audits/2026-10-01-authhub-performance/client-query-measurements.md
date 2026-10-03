# Client query measurements (local synthetic database)

The `getClientDetail` agency predicate now runs inside the first Prisma query. A foreign-agency lookup with 101 or 1,000 access requests issued **five queries before** and **one query after**. The before and after runs used the same generated fixture and 30 samples per case. The returned value stayed `null`; the change avoids loading related history before the ownership decision.

| 5,000-client agency case | Before queries | After queries | Before p50 / p95 wall ms | After p50 / p95 wall ms |
| --- | ---: | ---: | ---: | ---: |
| Foreign agency, 101 requests | 5 | 1 | 6.83 / 25.23 | 0.47 / 0.65 |
| Foreign agency, 1,000 requests | 5 | 1 | 35.11 / 69.92 | 0.73 / 1.33 |
| Authorized, 1,000 requests | 5 | 5 | 54.92 / 126.10 | 28.60 / 34.83 |
| First list page, 50 clients | 5 | 5 | 14.74 / 20.28 | 8.19 / 8.94 |
| Search, 50 matches | 5 | 5 | 23.20 / 185.75 | 11.25 / 14.80 |

The stable result is the query-count reduction for foreign-agency detail. Wall timings include local runtime and machine noise. The after run benefited from another pass over the same database; do not interpret the other timing differences as an effect of this edit. Search and list still use their original service code.

The fixture has 50, 500, and 5,000 clients in separate agencies. Every fourth client has an access request; every eighth has a connection and authorization. The 5,000-client agency also has clients with 101 and 1,000 request histories. Each case has five warmups and 30 timed service calls. The JSON files contain every raw wall/query-duration sample and full `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans: [before](client-query-measurements-before.json) and [after](client-query-measurements-after.json). Authentication, HTTP transport, provider calls, production network, and browser rendering are excluded. Prisma query event durations are rounded to integer milliseconds.

At this synthetic size, equivalent ID-only search and count predicates scan all 5,550 client rows. The selective search returns 50 rows and the no-match search returns zero. The after-run plans show 421 shared buffer hits and zero reads for each scan. These EXPLAIN statements use the same tenant and search predicates but **do not capture the full Prisma service SQL or nested relation cost**. They do not establish a production index need. Service-call query counts and wall samples are the evidence for the actual list/detail paths.

To reproduce, start an isolated local PostgreSQL cluster with a private Unix socket. Run these commands from the repository root. Use a free port if `55439` is taken. The benchmark guard rejects any URL except the `authhub_perf` user/database on a private socket inside an `authhub-performance-db-*` directory.

```sh
perf_root="$(mktemp -d /tmp/authhub-performance-db-XXXXXX)"
mkdir -m 700 "$perf_root/socket"
initdb -D "$perf_root/data" --auth-local=trust
printf "\nlisten_addresses = ''\nunix_socket_directories = '%s'\nport = 55439\n" "$perf_root/socket" >> "$perf_root/data/postgresql.conf"
pg_ctl -D "$perf_root/data" -l "$perf_root/postgres.log" start
createuser -h "$perf_root/socket" -p 55439 authhub_perf
createdb -h "$perf_root/socket" -p 55439 -O authhub_perf authhub_perf
export PERF_DATABASE_URL="postgresql://authhub_perf@localhost:55439/authhub_perf?host=$perf_root/socket"
DATABASE_URL="$PERF_DATABASE_URL" npm run db:push --workspace=@agency-platform/api
PERF_PHASE=after npx tsx --tsconfig apps/api/tsconfig.json scripts/perf/benchmark-client-queries.ts
pg_ctl -D "$perf_root/data" stop
```

For a paired baseline, temporarily use `where: { id: clientId }` in `getClientDetail`'s first `findUnique`, run the same command with `PERF_PHASE=before`, restore `where: { id: clientId, agencyId }`, then run `PERF_PHASE=after`. The script deletes and recreates only its deterministic synthetic agencies within the guarded disposable database.
