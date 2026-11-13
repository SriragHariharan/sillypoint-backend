# Sillypoint API

REST API for Sillypoint, a cricket tournament platform: tournaments, teams, matches, ball-by-ball scoring, live scorecards and points tables.
Frontend: [sillypoint-frontend](https://github.com/SriragHariharan/sillypoint-frontend).

## Features

- **Passwordless auth**: mobile number + 4-digit OTP, short-lived access JWT and a rotating refresh-token cookie
- **Demo accounts**: one-click organizer and team manager logins for visitors (no OTP)
- **Tournaments**: create with logo, dates, registration deadline, fee, prize money and squad size, then search and filter
- **Teams**: team managers create teams and enrol them before the registration deadline
- **Matches**: organizers schedule fixtures by stage, and every match gets a private scorer link + 6-digit PIN
- **Ball-by-ball scoring engine**: extras, wickets, free hits, retirements, undo, bowler quotas, automatic result and Super Over (with a boundary-count tie-break)
- **Live scorecards**: public, cached and built for polling (`ETag` / `304`)
- **Points table**: points, net run rate and form, calculated from completed league matches
- **Image uploads**: tournament / team logos and profile photos on Cloudinary

## Tech stack

Node.js · TypeScript (ESM) · Express 5 · PostgreSQL · Drizzle ORM · Zod · JSON Web Tokens · argon2 · Multer · Cloudinary · sanitize-html

## Getting started

```bash
npm install
cp .env.example .env      # fill in the values below
npm run db:migrate
npm run dev               # http://localhost:3000 (health check: GET /test)
```

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Watch mode / compile to `dist/` / run the build |
| `npm run db:generate` / `db:migrate` | Create / apply Drizzle migrations |
| `npm run check:scoring` · `check:standings` · `check:scorecard-cache` | Scenario checks for the scoring engine, points table and scorecard cache |

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ACCESS_TOKEN_SECRET` | Yes | Signs access and scorer tokens (32+ characters) |
| `REFRESH_TOKEN_SECRET` | Yes | Signs refresh tokens (32+ characters, different from the access secret) |
| `CLIENT_ORIGIN` | Yes | Allowed CORS origin, e.g. `http://localhost:5173` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | No | Only needed for image uploads |
| `DEMO_LOGIN_ENABLED` | No | `true` turns on the demo-account logins |
| `NODE_ENV` | No | `production` makes the refresh cookie `Secure` |

## API

Base URL `/api`. 🔓 public · 🔑 user access token (`Authorization: Bearer`) · 🏏 scorer token

**Auth** (details in [auth.md](auth.md))

| Method | Path | | Description |
| --- | --- | --- | --- |
| POST | `/auth/request-otp` | 🔓 | Send an OTP (signup or login is decided by the server) |
| POST | `/auth/verify-otp` | 🔓 | Verify the OTP, returns the access token and sets the refresh cookie |
| POST | `/auth/demo-login` | 🔓 | Log in to a demo account (`role`: `organizer` or `manager`) without an OTP |
| POST | `/auth/resend-otp` | 🔓 | Send a new OTP |
| POST | `/auth/refresh` · `/auth/logout` | cookie | Rotate the refresh token / end the session |
| GET | `/auth/me` | 🔑 | Current user |
| PUT · DELETE | `/users/me/avatar` | 🔑 | Upload / remove the profile photo |

**Tournaments, teams and matches**

| Method | Path | | Description |
| --- | --- | --- | --- |
| POST · GET | `/tournaments` | 🔑 · 🔓 | Create (multipart) / list with `q`, `status`, `registrationOpen`, `organizerId`, paging |
| GET | `/tournaments/:id` | 🔓 | Tournament details |
| POST · GET | `/tournaments/:id/teams` | 🔑 · 🔓 | Enrol teams / list enrolled teams |
| DELETE | `/tournaments/:id/teams/:teamId` | 🔑 | Remove a team (organizer or whoever added it) |
| POST · GET | `/tournaments/:id/matches` | 🔑 · 🔓 | Schedule a match (organizer) / list matches |
| GET | `/tournaments/:id/standings` | 🔓 | Points table |
| POST · GET | `/teams` | 🔑 | Create a team (multipart) / list my teams |
| GET · PATCH | `/teams/:id` | 🔑 | Team details / update |
| GET | `/teams/:id/matches` | 🔑 | Team summary and match history (`status`, paging) |
| GET | `/matches/:id` | 🔓 | Match details |
| GET | `/matches/:id/scorecard` | 🔓 | Live or final scorecard |
| GET | `/matches/:id/scorer/access` | 🔑 | Scorer link token and PIN (organizer only) |

**Scoring**

| Method | Path | | Description |
| --- | --- | --- | --- |
| POST | `/scorer/login` | 🔓 | Link token + PIN, returns a scorer token |
| GET | `/scorer/me` | 🏏 | Session, server time and when scoring opens |
| PUT | `/scorer/toss` · `/scorer/overs` | 🏏 | Set the toss / overs per side |
| GET · PUT | `/scorer/players` | 🏏 | Read / replace both squads |
| GET | `/scorer/scoring` | 🏏 | Full scoring state |
| POST | `/scorer/innings/start` | 🏏 | Opening batters and bowler |
| POST | `/scorer/innings/:n/deliveries` | 🏏 | Record a ball |
| POST | `/scorer/innings/:n/{batter,bowler,swap-strike,retire,undo,end}` | 🏏 | Other innings actions |

Notes:
- Errors are JSON `{ "message": "..." }` with a matching HTTP status. Validation errors are `400`.
- Every scoring change sends `expectedVersion`. A stale or repeated tap gets `409`, and each success returns the whole new state.
- Scoring opens 30 minutes before the match starts. Dates and times are in `Asia/Kolkata`.

## Database

PostgreSQL via Drizzle. The schema is in `src/db/schema/` and migrations are in `drizzle/`.

| Table | Holds |
| --- | --- |
| `users` | Accounts (mobile, status, avatar) |
| `otp` | Hashed OTPs with attempt, resend and block counters |
| `refresh_tokens` | Hashed refresh tokens per session family |
| `tournaments` | Tournament details and rules (organizer, dates, fee, squad size) |
| `teams` | Teams and their manager |
| `tournament_teams` | Which teams are enrolled in which tournament |
| `matches` | Fixtures, scorer login, toss, overs and result |
| `match_players` | Each match's playing XI and substitutes |
| `innings` | One row per innings with a cached score snapshot and version |
| `deliveries` | Immutable ball-by-ball event log (undo marks a ball as voided) |

## Project structure

```
src/
├── app.ts              Express setup (CORS, cookies, error handler)
├── routes.ts           Mounts every module under /api
├── modules/<feature>/  routes → controller → service → repository (+ schema, constants)
├── engines/            Pure TypeScript rules: scoring, standings (no Express or DB)
├── shared/             Config, middleware, HTTP helpers, constants, storage, utils
└── db/                 Drizzle client and table schemas
drizzle/                SQL migrations
scripts/                Engine scenario checks
```

## Notes

- OTPs are only logged to the console (no SMS provider). Visitors use the demo accounts instead.
- There is no WebSocket yet. Clients poll the cached scorecard endpoint for live scores.
- There is no test runner. The `check:*` scripts verify the engines with plain `node:assert`.
