# Sillypoint Backend

Cricket tournament management backend/API: tournaments, teams, fixture generation, ball-by-ball scoring, live scores, stats. Users: organizers, team managers, scorers, public spectators (no login).

## Stack
Express 5, TypeScript (ESM, NodeNext), Drizzle ORM + `postgres`, PostgreSQL. Env: `DATABASE_URL` (see `.env.example`).
Standards for things not yet installed: `zod` (validation), `argon2` (password hashing), `jsonwebtoken` (JWT).
Undecided (ask before adding): WebSocket library, test runner, logger. No Redis for MVP.

## Commands
- `npm run dev` — tsx watch
- `npm run build` — `tsc` (use to type-check)
- `npm run db:generate` / `npm run db:migrate` — Drizzle Kit (see `db-migration` skill)

## Layout
Feature modules + pure engines (adopt as each feature starts; don't scaffold empty folders):
- `src/modules/<feature>/` — `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts` (+ `*.schema.ts` zod, `*.constants.ts`). Features: auth, tournaments, teams, fixtures, matches, scoring, stats, announcements, public.
- `src/engines/` — pure TS (fixtures, scoring, standings, stats). No imports from express, db or modules.
- `src/realtime/` — WebSocket server and match hub.
- `src/shared/` — `http/response.ts` (`success`, `failure`), middleware (authenticate, authorize, validate, error-handler), utils (shuffle), `constants/` (constants used by more than one module).
- `src/db/` — `schema/*` re-exported from `schema/index.ts`. `src/routes.ts` mounts module routers under `/api`.
Dependency direction: routes → controller → service → repository → db; service → engines. See `add-endpoint` skill.
(Current code still uses `src/routes` + `src/handlers` + `src/helpers`; migrate when Sprint 1 starts.)

## Conventions
- Relative imports end in `.js`; use `import { type X }` for types.
- 4-space indent, double quotes, no semicolons.
- `strict` + `noUncheckedIndexedAccess` are on; no `any`.
- Constants (magic numbers, TTLs, fixed messages, limits) never live in service/controller/repository/routes files. Put them in `src/modules/<feature>/<feature>.constants.ts` (UPPER_SNAKE_CASE, exported); if used by 2+ modules, put them in `src/shared/constants/`. Import them with the `.js` suffix.
- Tables: identity integer `id`, snake_case columns, `timestamp(..., { withTimezone: true })`.

## Auth
Mobile + password, OTP verification (`otp` table: `signup` / `password_reset`), JWT sent as `Authorization: Bearer`. Hash passwords and OTPs; never log secrets.
Signup flow: `signup` → `verify-otp` (returns a 10-min, purpose `set_pin` JWT in the body) → `set-pin` (`Authorization: Bearer`, PIN + confirm_pin, 4 digits via `PIN_LENGTH`). PIN is argon2-hashed into `users.hashed_password` and can be set only once. JWT helpers live in `src/shared/utils/jwt.ts` (HS256 pinned, secret from `JWT_SECRET` env, min 32 chars); every token carries a `purpose` claim that its endpoint must check.

## Domain rules (from PRD)
- Keep engines separate: Tournament/Fixture engine (who plays whom) → Match engine → Scoring engine → Live broadcast. No tournament logic in scoring.
- Fixture generation is independent of scheduling (date/time/venue).
- Dynamic Knockout: server-side Fisher-Yates shuffle, odd count → bye, generated rounds are locked (never regenerate existing matches).
- Team removal behaves by state: before fixtures → just remove; fixtures generated, not started → invalidate + regenerate; started → keep completed matches, cancel future ones.
- Test fixture generators with 4, 5, 8, 10, 20, 21 teams.
- Store every delivery as an immutable event; backend derives authoritative match state (frontend is never the source of truth). Corrections keep an audit trail (original, changed, by, at).
- Concurrency: client sends `expected_version`; reject if it differs from `match_version`. Prevent duplicate deliveries.
- Authorization checks: tournament owner, team owner, assigned scorer (only for their match), valid match state.
- Public endpoints (tournament, match, scorecard, standings, live) need no auth.
- API under `/api/...`; WebSocket at `/ws/matches/:matchId` with events `DELIVERY_RECORDED`, `SCORE_UPDATED`, `WICKET`, `OVER_COMPLETED`, `INNINGS_COMPLETED`, `MATCH_COMPLETED`.

