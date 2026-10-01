# Implement authentication and authorization

This is milestone 07 of **PortfolioPilot**, a stock portfolio teaching application. It uses React/Vite for the frontend, a Next.js API, PostgreSQL, Redis and the Claude Agent SDK runtime. Nothing has been deployed or pushed.

See [project state](docs/project-state.md) for recorded results, [project plan](docs/project-plan.md) for milestone scope, and [lesson 07](docs/lessons/07-authentication-and-authorization.md) for additional teaching notes.

## Purpose: protect access to each user's data

This prompt asks the coding agent to add sign-in, server-managed sessions, logout and ownership checks. It also asks for a local demo that works without Microsoft credentials and a production sign-in path using Microsoft Entra ID.

**Authentication** answers “Who is making this request?” **Authorization** answers “May this person access this resource?” Both matter: a signed-in user must still be prevented from reading another user's portfolio.

Students will learn how to:

- Choose an authentication library using official documentation and installed TypeScript definitions.
- Store sessions in PostgreSQL and use protected cookies to identify requests.
- Derive the user from a verified session instead of accepting a browser-supplied user ID.
- Check ownership in server helpers and repositories, which are functions that read or write database records.
- Block **CSRF** (cross-site request forgery): attempts by another website to send an unwanted action using a user's cookies.
- Separate a convenient development-only demo from production identity-provider configuration.
- Report passing tests, skipped checks and unverified behavior honestly.

## Steps performed during implementation

The following describes the work actually performed for this milestone, in order.

1. **Inspected the starting application.** Read `AGENTS.md`, project state, the milestone plan, existing routes, configuration and database code. Milestone 06 already supplied the authentication tables and owner-scoped repositories, so they were reused without a new migration.

2. **Checked documentation and selected Better Auth 1.7.7.** Reviewed its official Next.js, Prisma, Microsoft provider, session, plugin and security documentation, plus installed library types/source and Next.js Route Handler documentation. A Route Handler is a server function responding to an HTTP request. The decision is recorded in [ADR 0003](docs/decisions/0003-authentication-and-sessions.md), an architecture decision record explaining the choice and alternatives.

   The library was pinned in the API workspace and the lockfile updated. No existing direct dependency versions were upgraded. The equivalent standard installation command is:

   ```powershell
   npm install better-auth@1.7.7 --workspace apps/api --save-exact --no-audit --no-fund
   ```

   On the implementation machine, the nvm npm wrapper refused delegated execution. Installation and project commands were run through the already installed npm CLI using Node instead. Remaining workspace dependencies were then installed.

3. **Implemented authentication and configuration safeguards.** Added `apps/api/lib/auth.ts` and extended `packages/config/src/server.ts`. Better Auth manages database sessions, cookie signatures and logout. Sessions expire after eight hours without automatic extension. Cookie session caching and password authentication are disabled. Demo sign-in accepts only the aliases `alice` and `bob`, rejects extra fields, and maps them to fixed seeded users. It requires an explicit development/test opt-in. Missing OIDC credentials do not block this local path.

   **OIDC** (OpenID Connect) is a standard for signing in through an identity provider. The production Microsoft provider uses one configured Entra tenant, with automatic account linking disabled. Provider tokens are encrypted through the library. A **tenant** is an organization's directory in Entra ID.

4. **Protected server routes and reused ownership checks.** Added `requireAuthorization` and `requirePortfolio` in `apps/api/lib/authorization.ts`. Each request verifies the cookie and current database session before creating a trusted owner context for the existing repositories. Added `/api/me` and a read-only `/api/portfolios/[id]` route. Restricted the temporary demo AI route to authenticated, explicitly enabled local development use. Missing and foreign portfolios return the same safe error.

5. **Added mutation and authentication endpoint boundaries.** Added the auth catch-all Route Handler and exact-origin checks. An **origin** is the combination of scheme, hostname and port, such as `http://localhost:5173`. Cookie-authenticated actions require that configured origin; the library's CSRF protections remain enabled. Only required sign-in, sign-out, options and Microsoft callback routes are exposed. Health and the sign-in handshake remain anonymous. No wildcard or credentialed CORS access was added; CORS is the browser mechanism for allowing requests between different origins.

6. **Added the frontend sign-in gate.** Created `apps/web/src/auth.tsx` and updated `App.tsx`. The gate checks `/api/me`, shows the session identity and expiry, provides demo/Microsoft sign-in and logout, and clears query caches when access ends. Existing financial screens remain explicitly labeled static fixtures: prepared sample data, not the signed-in user's database portfolios.

7. **Ran database, build and live API verification.** Created a separate `portfolio_m07_auth_verify` database in the existing local PostgreSQL 17.6 container on port 5546, applied the existing migration and ran real session/ownership tests. Also ran the build, typecheck, unit tests and browser dependency check. A live Next.js API was tested through Vite's proxy, which forwards `/api` requests from the frontend to the API.

8. **Corrected issues found by verification and documented the outcome.** Fixed TypeScript return/provider/cookie type mismatches. An OIDC test exposed the library's test-mode origin-check default, so security checks were explicitly enabled for tests as well as runtime. A production startup check showed that throwing from Next.js instrumentation could leave the process running; `apps/api/instrumentation.ts` now explicitly exits on invalid production configuration. Updated project state, versions, ADR index, lesson notes and this README.

### Main files created or modified

| Files | Responsibility |
| --- | --- |
| `apps/api/lib/auth.ts` | Better Auth setup, demo plugin, Entra provider and origin checks |
| `apps/api/lib/authorization.ts` | Reusable session and portfolio authorization helpers |
| `apps/api/app/api/auth/[...all]/route.ts` | Expose the required authentication endpoints |
| `apps/api/app/api/me/route.ts` | Return safe identity and expiry information |
| `apps/api/app/api/portfolios/[id]/route.ts` | Read a portfolio only when the caller owns it |
| `apps/api/app/api/demo/ask/route.ts`, `apps/api/lib/http.ts` | Restrict demo AI access and return safe HTTP errors |
| `apps/api/instrumentation.ts`, `packages/config/src/server.ts` | Validate configuration and refuse unsafe production startup |
| `apps/api/lib/auth.test.ts`, `auth.integration.test.ts` | Unit and real PostgreSQL acceptance checks |
| `apps/web/src/auth.tsx`, `apps/web/src/App.tsx` | Protected frontend gate and session controls |
| `apps/api/package.json`, `package-lock.json`, `apps/api/.env.example` | Pinned dependency and configuration examples |
| `docs/project-state.md`, `docs/versions.md`, ADR 0003, ADR index, lesson 07, `README.md` | Results, decisions and student instructions |

## Results achieved and observed behavior

The API uses PostgreSQL-backed sessions and signed **HttpOnly** cookies, which browser JavaScript cannot read. Cookies use **SameSite=Lax**, limiting when browsers send them across sites. Production cookies also use **Secure**, restricting transmission to HTTPS. Local plain HTTP uses HttpOnly/SameSite cookies without the Secure requirement.

The following results were observed in automated tests or the live API smoke check:

| Check | Observed result |
| --- | --- |
| Anonymous request to `/api/me` or a portfolio | `401 Unauthorized` |
| Demo sign-in with an allowed alias | `200`, session cookie issued, identity available through `/api/me` |
| Sign-in with an arbitrary user ID or unknown alias | `400 Bad Request` |
| Alice reads her portfolio; Bob reads his | `200` |
| Either user requests the other user's portfolio | `404 Not Found`, matching the missing-resource error |
| Mutation from an untrusted origin | `403 Forbidden`, including first sign-in and logout |
| Replay of a cookie after logout | `401 Unauthorized` |
| Expired session or altered cookie signature | `401 Unauthorized` |
| Authenticated local mock AI request through Vite | `200` |
| Production startup with demo auth enabled | Refused configuration and exited with code `1` |

Successful demo login returns this body; the session cookie arrives separately in an HTTP response header:

```json
{"ok":true}
```

Recorded test summaries were:

```text
Full unit suite: 30 passed, 8 optional database tests skipped without their URL
API suite with PostgreSQL configured: 17 passed
```

`npm run build`, `npm run typecheck` and the browser dependency boundary check passed. The latter checks that frontend dependencies do not pull in server-only code or secrets. API checks covered eight database integration tests and three new authentication unit tests alongside existing API tests.

The frontend gate and logout controls were implemented and compiled successfully. Their visual appearance and click-through behavior were **not** verified in a browser during milestone 07 because no browser was connected.

## How to run the local demo

### Prerequisites

- Node.js **24.21.0** and npm **11.19.0**, matching the project's pinned toolchain.
- Docker with a running Linux container engine and Docker Compose, or an equivalent local PostgreSQL setup. The supplied Compose file uses PostgreSQL **17.6** and Redis **7.4.5**.
- Available ports: web `5173`, API `3001`, PostgreSQL `5432`, Redis `6379`.
- A PowerShell terminal opened at this repository's root and registry access for dependency installation.

The demo needs PostgreSQL and seeded accounts, but no Entra, AI or market-data credentials. Redis belongs to the supplied infrastructure stack and readiness checks; authentication sessions themselves live in PostgreSQL.

### 1. Install dependencies and start infrastructure

```powershell
node --version
npm --version
npm ci --no-audit --no-fund
npm run infra:start
npm run infra:status
```

These are student setup instructions. The milestone's verified database checks used the separate port-5546 container, not a new verification of the normal Compose startup sequence. If Docker is inaccessible, fix engine access before continuing.

### 2. Configure the API without overwriting existing settings

```powershell
if (-not (Test-Path apps/api/.env.local)) {
    Copy-Item apps/api/.env.example apps/api/.env.local
}
```

In `apps/api/.env.local`, merge or confirm these local-only values:

```dotenv
DATA_MODE=mock
AGENT_MODE=mock
DATABASE_URL=postgresql://portfolio_local:local_only_change_me@127.0.0.1:5432/portfolio_pilot
REDIS_URL=redis://127.0.0.1:6379
DEMO_AUTH_ENABLED=true
AUTH_BASE_URL=http://localhost:5173
```

These database credentials are public teaching examples for local use only. Leave all Entra variables absent for the demo. An optional persistent `AUTH_SECRET` of at least 32 random characters lets local sessions survive API restarts; without it, the API generates a process-specific secret and old cookies stop working after restart.

### 3. Apply the database schema and seed the demo users

A **migration** applies a recorded database schema change. A **seed** inserts predictable teaching data. The command-line database tools need environment variables in the terminal; they do not rely on Next.js reading `.env.local`.

```powershell
$env:DATABASE_URL='postgresql://portfolio_local:local_only_change_me@127.0.0.1:5432/portfolio_pilot'
$env:NODE_ENV='development'
$env:ALLOW_DEMO_SEED='true'
npm run build:types
npm run migrate:deploy --workspace @portfolio-pilot/db
npm run seed:demo --workspace @portfolio-pilot/db
```

`build:types` builds the shared packages, including the Prisma client and compiled seed command. The seed creates Alice and Bob and their sample portfolios; it does not create sessions. Its output identifies the historical synthetic data:

```text
Synthetic demo seeded at 2025-01-15T16:00:00Z; prices are not current market data.
```

### 4. Start the application

```powershell
npm run dev
```

Open **http://localhost:5173**. Use this exact hostname and port, matching `AUTH_BASE_URL`; `127.0.0.1` is a different origin. Vite forwards `/api` to Next.js on port 3001, while browser requests stay on the frontend origin.

Expected browser flow, supplied for students to verify manually:

1. An anonymous visitor sees sign-in rather than the protected workspace.
2. Choose **Sign in as Alice Demo**. The session banner should show Alice and an expiry time.
3. Open `/api/me` and `/api/portfolios/demo-growth` on the same origin; both should return `200`.
4. Open `/api/portfolios/demo-bob-core`; it should return `404`.
5. Sign out, then open `/api/me`; it should return `401`.
6. Sign in as Bob. His `demo-bob-core` resource should succeed and Alice's `demo-growth` should return `404`.
7. After logout, reload a protected frontend URL such as `/assistant`; the sign-in gate should appear.

Inspect cookies in browser developer tools to confirm HttpOnly and SameSite attributes. The financial pages still show shared static fixtures; use the API resources to check actual ownership isolation.

## How to verify the implementation

### Build and unit checks

From the repository root:

```powershell
npm run build
npm run typecheck
npm run test
npm run check:browser-boundary
```

Without `AUTH_TEST_DATABASE_URL`, eight database integration tests skip explicitly. A passing unit command alone does not demonstrate the database acceptance checks.

### Database acceptance checks

The test suite requires a separate loopback database named **portfolio_m07_auth_verify**. It seeds fixtures and expires/revokes sessions. Do not use the application database. The following repeats the setup actually used during implementation, assuming the milestone 06 verification container already exists:

```powershell
# Run CREATE DATABASE once; omit it on later test runs.
docker exec portfolio-pilot-m06-verify psql -U portfolio_local -d postgres -c 'CREATE DATABASE portfolio_m07_auth_verify'
$env:DATABASE_URL='postgresql://portfolio_local:local_only_change_me@127.0.0.1:5546/portfolio_m07_auth_verify'
npm run build:types
npm run migrate:deploy --workspace @portfolio-pilot/db
$env:AUTH_TEST_DATABASE_URL=$env:DATABASE_URL
npm run test --workspace @portfolio-pilot/api
```

If that container is unavailable, follow [lesson 06](docs/lessons/06-database-and-seed.md) to prepare it, or create the same dedicated database on your local PostgreSQL instance and adjust the port. That alternative is a setup option, not a reported milestone-07 verification result.

After testing, restore the application database URL and remove the optional test setting before starting the demo in that terminal:

```powershell
$env:DATABASE_URL='postgresql://portfolio_local:local_only_change_me@127.0.0.1:5432/portfolio_pilot'
Remove-Item Env:AUTH_TEST_DATABASE_URL -ErrorAction SilentlyContinue
```

### Reproduce origin rejection with an HTTP client

With the demo running, this request should return `403`. It illustrates an untrusted first-login request and does not require a cookie:

```powershell
curl.exe -i -X POST http://localhost:5173/api/auth/demo-sign-in `
  -H 'Origin: https://evil.example' `
  -H 'Content-Type: application/json' `
  --data-binary '{}'
```

This is a student reproduction command; the observed origin checks were run through automated handlers and a Node-based live HTTP smoke check. Legitimate command-line mutations must include `Origin: http://localhost:5173`. Requests with missing or mismatched Origin are rejected.

## Production Entra configuration and verification boundary

Production configuration requires a confidential Web application registered in one Microsoft Entra tenant. Supply these server-only values through your environment/secret manager:

```dotenv
NODE_ENV=production
DEMO_AUTH_ENABLED=false
AUTH_BASE_URL=https://<public-host>
AUTH_SECRET=<persistent random secret of at least 32 characters>
DATABASE_URL=<private PostgreSQL connection>
ENTRA_TENANT_ID=<tenant UUID>
ENTRA_CLIENT_ID=<application ID>
ENTRA_CLIENT_SECRET=<client secret>
```

Register `https://<public-host>/api/auth/callback/microsoft` as the Web redirect URI. Configure the ID token's optional email claim for managed users; the library needs email metadata, but email does not decide resource ownership. Use a specific tenant UUID, not `common` or `organizations`.

One HTTPS gateway must serve the web build and route `/api` to Next.js. `AUTH_BASE_URL` must be its exact public origin without a path or trailing slash. The required production values are checked at startup; demo opt-in causes exit code `1`, even with otherwise complete fixture configuration.

**Locally verified with fixture provider settings:** production Secure-cookie configuration, absence of the demo plugin, tenant-specific authorization URL, `openid` scope, OAuth state and PKCE generation, rejection of foreign redirect URLs and forged callbacks. **State** binds the callback to its initiating sign-in attempt; **PKCE** adds a proof tying authorization-code exchange to that attempt.

**Not verified against Microsoft:** interactive consent, real authorization-code exchange, identity-token validation with Microsoft's signing keys and nonce, persistence/repeat sign-in of real Entra users, managed-user email claims, MFA/tenant policies, and an actual HTTPS cookie round trip. These require real credentials, a registered callback and the gateway. After providing them, the next verification steps are:

```powershell
npm run build
npm run start --workspace @portfolio-pilot/api
```

Serve `apps/web/dist` through the same HTTPS gateway, choose **Sign in with Microsoft**, inspect `/api/me`, then sign out and confirm `401`. These are pending verification instructions, not evidence of a successful production login or deployment.

## Limitations, failures and unfinished work

- **Browser checks were skipped:** the browser tool reported no available browser. Run the manual Alice/logout/Bob/reload flow above to finish visual and interaction verification.
- **Live Entra is unverified:** no provider credentials were available. Only local configuration and protocol-initiation/rejection behavior were checked.
- **Initial checks failed and were corrected:** TypeScript type issues, test-mode origin checking and Next.js startup refusal were fixed and rechecked. The final build/typecheck and acceptance checks passed.
- **Warnings remain:** Vite reports module-level directive warnings; Next.js reports three Node/Edge analysis warnings in instrumentation. The routes run on Node, and builds succeeded with those warnings.
- **Tooling required a workaround:** the local npm wrapper refused execution, so the installed npm CLI was invoked directly. Use a working Node/npm installation for the student commands above.
- **Financial UI integration is unfinished:** pages remain labeled static fixtures until milestone 10. This milestone adds one read-only portfolio resource; full portfolio/transaction APIs belong to milestone 08.
- **Later operational work remains:** periodic session cleanup, distributed rate limiting and broader hardening are not completed here. Logout invalidates the PortfolioPilot session, not the Microsoft single sign-on session.
- **No release occurred:** this workspace had no Git repository; nothing was committed, pushed, provisioned in Azure or deployed publicly.

For the complete recorded milestone history, consult [project state](docs/project-state.md). For the authentication design and official sources checked during implementation, consult [ADR 0003](docs/decisions/0003-authentication-and-sessions.md).
