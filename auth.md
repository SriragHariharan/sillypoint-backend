# Authentication (Auth) Guide

How users sign up, log in, stay logged in and log out in the Sillypoint backend.

---

## 1. Auth in 30 seconds

- Users log in with a **mobile number + a 4-digit OTP**. There is **no password and no PIN**.
- **Signup and login are the same flow.** A new number becomes a new account. A known number logs in.
- A **correct OTP means the user is logged in**. The server then gives two tokens:
  - an **access token** (short life, sent in the response body)
  - a **refresh token** (long life, sent as a secure cookie)
- The access token is used on every API call. When it expires, the refresh token gets a new one.
- Everything is limited: wrong guesses, resends and session length all have caps.

---

## 2. Endpoints at a glance

All routes start with `/api/auth`.

| Method | Path           | What it does                              | Needs                 |
| ------ | -------------- | ----------------------------------------- | --------------------- |
| POST   | `/request-otp` | Send an OTP (signup or login)             | nothing               |
| POST   | `/verify-otp`  | Check the OTP, log the user in            | nothing               |
| POST   | `/resend-otp`  | Send a new OTP                            | nothing               |
| POST   | `/refresh`     | Swap the refresh cookie for new tokens    | refresh cookie        |
| POST   | `/logout`      | End the login session                     | refresh cookie        |
| GET    | `/me`          | Get the logged-in user                    | `Authorization: Bearer <access token>` |

Success responses return the data directly. Errors return `{ "message": "..." }`.

---

## 3. The login flow, step by step

```
 Frontend                                   Backend
    |  1. POST /request-otp {mobile}           |
    |----------------------------------------->|  create user (if new), make OTP,
    |  <- { userId, purpose }                  |  save its hash, "send" the OTP
    |                                          |
    |  2. user types the OTP                   |
    |  POST /verify-otp {userId, otp, purpose} |
    |----------------------------------------->|  check OTP, start a session
    |  <- { user, accessToken }                |
    |  <- Set-Cookie: refresh_token (HttpOnly) |
    |                                          |
    |  3. GET /me  (Authorization: Bearer ...) |
    |----------------------------------------->|  check access token
    |                                          |
    |  4. access token expired (401)           |
    |  POST /refresh (cookie is sent by browser)|
    |----------------------------------------->|  rotate refresh token
    |  <- { accessToken } + new cookie         |
    |                                          |
    |  5. POST /logout                         |
    |----------------------------------------->|  revoke session, clear cookie
```

Steps in words:

1. The frontend sends the mobile number to `request-otp`. It gets back a `userId` and a `purpose`.
2. The user enters the OTP. The frontend sends `userId`, `otp` and `purpose` to `verify-otp`.
3. On success the server returns the access token and sets the refresh cookie.
4. The frontend calls the API with the access token. If it gets a 401 "Access token expired", it calls `refresh` once and retries.
5. On logout the session is revoked and the cookie is cleared.

> For now the OTP is only **printed in the backend console**. SMS sending (MSG91) is not added yet.

---

## 4. Each endpoint

### `POST /request-otp`

Body:

```json
{ "mobile": "9876543210" }
```

- `mobile` must be exactly 10 digits.
- `purpose` is decided by the server:
  - new number, or number not verified yet -> `signup`
  - verified user -> `login`
- The reply looks the same for both, so nobody can tell if a number is registered.

Success `201`:

```json
{ "message": "OTP sent", "userId": 12, "purpose": "signup" }
```

Asking again while an OTP already exists counts as a **resend** (see section 5).

### `POST /verify-otp`

Body:

```json
{ "userId": 12, "otp": "4829", "purpose": "signup" }
```

Success `200`:

```json
{
  "message": "OTP verified",
  "user": { "id": 12, "mobile": "9876543210" },
  "isNewUser": true,
  "accessToken": "<jwt>",
  "expiresIn": 900
}
```

- Also sets the `refresh_token` cookie.
- The OTP is deleted after it works (**one use only**).
- For a `signup` OTP the user also becomes `active`.

### `POST /resend-otp`

Body:

```json
{ "userId": 12, "purpose": "signup" }
```

Success `200`:

```json
{ "message": "OTP resent", "resendsLeft": 4 }
```

### `POST /refresh`

- No body. The browser sends the `refresh_token` cookie.
- Success `200`: `{ "message": "Token refreshed", "accessToken": "<jwt>", "expiresIn": 900 }` plus a **new** cookie.
- Failure `401`: the cookie is cleared and the user must log in again.

### `POST /logout`

- No body. Uses the `refresh_token` cookie.
- Always returns `200` `{ "message": "Logged out" }`, even if the cookie was missing or bad.
- Revokes the whole login session and clears the cookie.

### `GET /me`

- Send the header `Authorization: Bearer <access token>`.
- Success `200`: `{ "user": { "id": 12, "mobile": "9876543210" } }`.
- Blocked or deleted users get `401`.

---

## 5. OTP rules

All numbers live in `src/modules/auth/auth.constants.ts`.

| Rule                  | Value                                                        |
| --------------------- | ------------------------------------------------------------ |
| OTP length            | 4 digits                                                     |
| OTP life              | 10 minutes                                                   |
| Wrong guesses allowed | 5                                                            |
| Resends allowed       | 5                                                            |
| Block time            | 30 minutes (after 5 wrong guesses, or after the resend limit)|

More details:

- The OTP is **hashed with argon2**. The plain OTP is never stored.
- The 5th wrong guess blocks the user for 30 minutes (`429`).
- Trying to resend after 5 resends also blocks for 30 minutes.
- While blocked, verify, resend and request-otp all fail with `429`.
- When the block time ends, the next request starts fresh (counters go back to 0).
- A **resend keeps the wrong-guess count**. Users cannot reset their guesses by asking for a new OTP.
- An **expired OTP does not use up an attempt**.
- There is **one OTP row per user and purpose**. The row is locked while it is checked, so parallel requests cannot cheat the limits.

---

## 6. Tokens and sessions

|                  | Access token                     | Refresh token                              |
| ---------------- | -------------------------------- | ------------------------------------------ |
| Life             | **15 minutes**                   | **7 days**                                 |
| Sent as          | JSON body (`accessToken`)        | `refresh_token` cookie                     |
| Frontend stores  | in memory only                   | nothing (browser keeps the cookie)         |
| Secret           | `ACCESS_TOKEN_SECRET`            | `REFRESH_TOKEN_SECRET` (different)         |
| Saved in DB?     | no (stateless)                   | yes, **only its SHA-256 hash**             |
| Format           | JWT, HS256, `aud: access`        | JWT, HS256, `aud: refresh`, has `jti` + `fam` |

### The cookie

- `HttpOnly`: JavaScript cannot read it.
- `SameSite=Strict`: only sent from our own site.
- `Secure`: on in production (HTTPS only).
- `Path=/api/auth`: only sent to the auth routes.

### Session length

A login session can never last more than **30 days**, even if the user keeps refreshing.

### Rotation

Every `refresh` call:

1. marks the old refresh token as used,
2. creates a new refresh token in the same session (same `fam` id),
3. returns a new access token.

### Reuse detection (stolen token protection)

- If an **old, used** refresh token is sent again, something is wrong.
- Within **10 seconds** it is treated as a double request (two tabs, React double-fire): it just fails with `401`.
- After 10 seconds it is treated as theft: the **whole session is revoked**, so the thief and the real user are both logged out.

### Logout and blocked users

- Logout revokes every token in that session.
- If a user becomes `blocked`, their next `refresh` fails and the session is revoked. Their access token keeps working for up to 15 minutes.

---

## 7. Protecting a route

Use the `authenticate` middleware (`src/shared/middleware/authenticate.ts`):

```ts
import { authenticate } from "../../shared/middleware/authenticate.js"

router.get("/something", authenticate, controller)
```

Inside the controller, the logged-in user id is here:

```ts
const userId = res.locals.userId as number
```

| Situation                          | Response                                   |
| ---------------------------------- | ------------------------------------------ |
| No header, wrong format, bad token | `401` `Unauthorized`                       |
| Access token expired               | `401` `Access token expired` (frontend should call `/refresh`) |

---

## 8. Security checklist

- OTPs are hashed (argon2). Refresh tokens are stored only as hashes.
- Access and refresh tokens use **different secrets**. The server will not start if they are the same or shorter than 32 characters.
- JWT algorithm is fixed to HS256. Issuer and audience are checked, so a refresh token cannot be used as an access token.
- Wrong user id and missing OTP give the same error, so user ids cannot be guessed.
- CORS allows **one origin only** (`CLIENT_ORIGIN`), with credentials.
- `refresh` and `logout` also check the `Origin` header (extra protection for cookie routes).
- Token responses send `Cache-Control: no-store`.
- `x-powered-by` header is turned off.
- Input is checked with zod before any logic runs.
- Every step that must succeed together (user + OTP, token rotation) runs in one DB transaction.

---

## 9. Database tables

**`users`**

| Column   | Meaning                                                       |
| -------- | ------------------------------------------------------------- |
| `id`     | user id                                                       |
| `mobile` | 10 digits, unique                                             |
| `status` | `inactive` = not verified yet, `active` = verified, `blocked` = not allowed (set by hand in the DB) |

**`otp`** (one row per user + purpose)

| Column          | Meaning                                       |
| --------------- | --------------------------------------------- |
| `user_id`       | owner (deleted with the user)                 |
| `purpose`       | `signup` or `login`                           |
| `otp_hash`      | argon2 hash of the code                       |
| `attempts`      | wrong guesses so far (max 5)                  |
| `resend_count`  | resends so far (max 5)                        |
| `expires_at`    | when this code stops working                  |
| `blocked_until` | if set and in the future, the user is blocked |

**`refresh_tokens`**

| Column               | Meaning                                              |
| -------------------- | ---------------------------------------------------- |
| `user_id`            | owner (deleted with the user)                        |
| `family_id`          | one id per login session, shared by all its tokens   |
| `token_hash`         | SHA-256 of the token (unique)                        |
| `expires_at`         | when this token stops working                        |
| `session_expires_at` | hard end of the session (30 days after login)        |
| `revoked_at`         | set when the token is used, or the session is ended  |

Deleting a user also deletes their OTP and refresh token rows.

---

## 10. Config (`.env`)

| Variable               | Rule                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection string                                  |
| `ACCESS_TOKEN_SECRET`  | at least 32 characters                                      |
| `REFRESH_TOKEN_SECRET` | at least 32 characters, **different** from the access secret |
| `CLIENT_ORIGIN`        | frontend URL, for example `http://localhost:5173`           |
| `NODE_ENV`             | set to `production` to turn on `Secure` cookies             |

The server checks these at startup and stops with a clear error if something is wrong. The API runs on port `3000`.

---

## 11. Where the code lives

```
src/modules/auth/
  auth.routes.ts        routes and middleware order
  auth.controller.ts    reads the request, sends the response, sets cookies
  auth.service.ts       OTP rules: request, resend, verify, me
  auth.repository.ts    database queries for users and OTPs
  auth.schema.ts        zod checks for request bodies
  auth.constants.ts     ALL limits, times and messages
  auth.cookies.ts       set / clear the refresh cookie
  session.service.ts    issue, refresh (rotate) and logout sessions
  session.repository.ts database queries for refresh tokens
src/shared/
  middleware/authenticate.ts     checks the access token
  middleware/allowed-origin.ts   Origin check for cookie routes
  middleware/validate.ts         runs the zod schema
  utils/jwt.ts                   sign / verify tokens
  config/env.ts                  reads and checks env variables
  constants/jwt.ts               token issuer, audience, messages
src/db/schema/           users.ts, otp.ts, refresh-tokens.ts
```

Request path: `routes -> controller -> service -> repository -> database`.

---

## 12. Error cheat sheet

| Status | Message                                        | When                                              |
| ------ | ---------------------------------------------- | ------------------------------------------------- |
| 400    | `Mobile must be 10 digits` / `OTP must be 4 digits` / `Invalid purpose` ... | bad request body |
| 400    | `Invalid OTP. N attempts left`                 | wrong OTP                                         |
| 400    | `Invalid or expired OTP`                       | no OTP found for that user                        |
| 400    | `OTP expired, please request a new one`        | OTP is too old                                    |
| 400    | `Cannot resend OTP`                            | nothing to resend (user or OTP missing)           |
| 401    | `Unauthorized`                                 | missing or bad access token                       |
| 401    | `Access token expired`                         | call `/refresh`                                   |
| 401    | `Invalid or expired session`                   | bad, used, expired or revoked refresh token       |
| 403    | `Account is blocked`                           | user status is `blocked`                          |
| 403    | `Origin not allowed`                           | cookie route called from another site             |
| 429    | `Too many attempts. Try again in N minutes`    | user is blocked (wrong guesses or too many resends) |
| 500    | `Internal server error`                        | unexpected error (details are only in the server log) |

---

## 13. Known limits and to-do

- OTP is **printed to the console**. MSG91 SMS sending is still to do (`sendOtp` in `auth.service.ts`).
- No per-IP rate limit yet. Someone who knows a number can use up its attempts and block that user for 30 minutes.
- Access tokens cannot be revoked. They stay valid for up to 15 minutes.
- No "log out from all devices" endpoint.
- The cookie uses `SameSite=Strict`. If the frontend and API are ever hosted on different domains, this must change to `None; Secure`.
- Each user has one OTP row per purpose, so requests from two devices at once share the same limits.

---

## 14. Tips for the frontend

- Send requests to `/api/auth/*` with **credentials** (`withCredentials: true` in axios), or the cookie will not travel.
- Keep the access token **in memory only**. Never put it in localStorage.
- On `401 Access token expired`, call `/refresh` **once**, then retry. If many requests fail together, run only one refresh.
- Keep the `userId` and `purpose` from `request-otp`. `verify-otp` and `resend-otp` need them.
- The OTP timers (10-minute expiry, 30-second resend wait) are frontend-only. The server is still the final judge.
