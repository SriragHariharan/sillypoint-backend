---
name: db-migration
description: Change the Drizzle schema and produce a Postgres migration. Use when adding or altering tables, columns, enums, indexes or constraints.
---

# DB migration workflow

1. Edit or add a table in `src/db/schema/<name>.ts` (identity integer `id`, snake_case columns, `timestamp(..., { withTimezone: true })`, constraints via `check`/`index` in the table callback). Follow `users.ts` / `otp.ts`.
2. Export it from `src/db/schema/index.ts`.
3. Run `npm run db:generate`. This writes SQL plus a snapshot in `drizzle/`.
4. Read the generated SQL. Confirm it does only what you intended (no unexpected drops or renames).
5. Never hand-edit `drizzle/meta/*` snapshots or the journal.
6. Run `npm run db:migrate` only after the user approves. It applies to the database in `DATABASE_URL`.
7. Run `npm run build` to type-check, and commit the schema change, SQL and meta files together.
