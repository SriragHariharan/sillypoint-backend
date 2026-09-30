# Sillypoint Backend

Cricket tournament management backend/API: tournaments, teams, fixture generation, ball-by-ball scoring, live scores, stats. Users: organizers, team managers, scorers, public spectators (no login).

## Stack
Express 5, TypeScript (ESM, NodeNext), Drizzle ORM + `postgres`, PostgreSQL. Env: `DATABASE_URL` (see `.env.example`).
Installed standards: `zod` (validation), `argon2` (hashing OTPs), `jsonwebtoken` (JWT), `multer` (multipart uploads, memory storage), `cloudinary` (image storage), `sanitize-html` (user HTML).
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
Mobile + OTP only: no passwords or PINs. Signup and login are the same flow: `POST /api/auth/request-otp` (new mobile -> `signup` OTP, verified user -> `login` OTP; same response `{ userId, purpose }` either way) -> `verify-otp` (a correct OTP means the user is logged in; `signup` also activates the user), with optional `resend-otp`. `otp` table purposes: `signup` / `login`. Hash OTPs; never log secrets (the OTP is only console-logged until MSG91 is added).
OTP limits (constants in `auth.constants.ts`): 4 digits, 10-min expiry, 5 wrong guesses, 5 resends, then a 30-min block; the OTP row is locked (`FOR UPDATE`) while verifying/resending.
Sessions: `verify-otp` returns a 15-min access JWT in the body (frontend keeps it in memory, sends `Authorization: Bearer`) and sets a 7-day refresh JWT as an HttpOnly, SameSite=Strict cookie (`Path=/api/auth`, `Secure` in production). Access and refresh tokens use different secrets (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, each 32+ chars, must differ; also `CLIENT_ORIGIN` for CORS). Refresh tokens rotate on every `POST /api/auth/refresh`, only their SHA-256 hash is stored (`refresh_tokens`), reuse of a rotated token ends the whole session family, and a session ends 30 days after login. `POST /api/auth/logout` revokes it. Protect routes with `authenticate` (`src/shared/middleware/authenticate.ts`, sets `res.locals.userId`); cookie endpoints also use `requireAllowedOrigin`. JWT helpers: `src/shared/utils/jwt.ts` (HS256 pinned, issuer + audience checked); env is validated in `src/shared/config/env.ts`. Frontend: `withCredentials` on `/api/auth/*`, never store the access token in localStorage, serialize refresh calls.

## Tournaments
`/api/tournaments` (`src/modules/tournaments/`): `POST /` (authenticated; multipart `name, description, location, startDate, endDate, logo?`), `POST /:id/cancel` (organizer only; POST because CORS allows only GET/POST), public `GET /` (filters `q, status, startFrom, startTo, organizerId`, paging `page, limit`) and public `GET /:id` (includes `organizer: { id, mobile }`). `tournaments.organizer_id` references `users.id` (restrict) and is always the logged-in user, never read from the body; only an active user can organize (`authService.getMe`). Only `cancelled_at` is stored; `status` (`upcoming | live | completed | cancelled`) is derived from the dates in `Asia/Kolkata` (`TOURNAMENT_TIMEZONE`). The description is HTML from the rich text editor and is sanitized to `DESCRIPTION_ALLOWED_TAGS` before saving. Logos go through `imageUpload` (`shared/middleware/upload.ts`, 2 MB, png/jpeg/webp) to Cloudinary (`shared/storage/cloudinary.ts`); `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are read lazily, so the server starts without them and only logo uploads fail. `validate(schema, "params" | "query")` puts parsed values in `res.locals.params` / `res.locals.query`.

## Profile photos
`users.avatar_url` / `avatar_public_id` (nullable). `PUT /api/users/me/avatar` (authenticated, multipart field `avatar`, 2 MB, png/jpeg/webp) uploads to Cloudinary folder `sillypoint/dp` (`AVATAR_FOLDER`, stored as a 512×512 crop), saves it under a row lock, then deletes the previous image (best effort); if saving fails the new upload is deleted. `DELETE /api/users/me/avatar` deletes the image from Cloudinary **first** and only then clears the columns (a Cloudinary failure returns 502 and keeps the photo, so it can be retried). `deleteImage` returns `true/false` (already-missing counts as deleted) instead of throwing. `GET /api/auth/me`, the `verify-otp` `user` and a tournament's `organizer` all include `avatar` (URL or null). CORS `methods` now include `PUT` and `DELETE`. `src/modules/users/` owns this.

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

