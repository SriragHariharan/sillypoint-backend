---
name: add-endpoint
description: Add a new REST endpoint to the Sillypoint backend following the feature-module structure. Use when asked to create or extend an API route.
---

# Add an endpoint

Work inside `src/modules/<feature>/` (create the module if it doesn't exist). If the repo still has the legacy `src/routes` + `src/handlers` layout, follow CLAUDE.md's migration note.

1. **Validate** input with a `zod` schema in `<feature>.schema.ts` (params/query/body); apply via the `validate` middleware.
2. **Repository** (`<feature>.repository.ts`): Drizzle queries only, using `db` from `src/db/postgres.js` and tables from `src/db/schema/index.js`.
3. **Service** (`<feature>.service.ts`): business rules, authz-relevant state checks, transactions. Call `src/engines/*` for cricket logic; call other modules via their service, never their repository.
4. **Controller** (`<feature>.controller.ts`): `(req: Request, res: Response)`; respond only via `success` / `failure` from `shared/http/response.js`. Express 5 forwards async errors.
5. **Routes** (`<feature>.routes.ts`): `Router()`, attach middleware (`authenticate`, then `authorize` for tournament owner / team owner / match scorer as needed), `export default router`; mount in `src/routes.ts` under `/api`. Public spectator routes go in `modules/public` with no auth.
6. **Constants**: never declare constants (TTLs, limits, fixed messages) in the files above. Add them to `<feature>.constants.ts` (or `src/shared/constants/` if shared across modules) and import them.
7. Imports use the `.js` suffix; 4-space indent, double quotes, no semicolons.
8. Verify: `npm run build` passes; hit the endpoint with `npm run dev` when practical.
