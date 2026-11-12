# Click Marketing Agent

A business-agnostic, multi-business marketing workspace for website auditing, SEO recommendations, AI-assisted content, scheduling, and human approval workflows.

Release labels use **Version _n_ · Build _n_**. The version identifies the product milestone; the build increments for each shipped update within that version. The authoritative value is in `packages/shared/src/version.ts`; run `npm run version:bump` before a new build is committed.

## Architecture

- `apps/web` — responsive React/Vite single-page application
- `apps/api` — Fastify REST API, crawler, SEO engine, authentication, and AI provider layer
- `apps/api/prisma` — MySQL/MariaDB schema, migrations, and development seed
- `packages/shared` — shared Zod request contracts and TypeScript types
- `docs` — architecture and release roadmap

The API uses controller-like route registrations over reusable services. Prisma provides parameterised database access. The crawler validates DNS targets on every request and only follows same-domain HTTP(S) links. OpenAI calls are isolated in `AiService`, use the Responses API with strict JSON Schema output, and are validated again with Zod before persistence.

## Local setup

Requirements: Node.js 20+, npm, and a MySQL 8/MariaDB 11-compatible server. Docker is optional.

1. Copy `.env.example` to `.env` and replace `JWT_SECRET`.
2. Start MariaDB locally (Windows: confirm `Get-Service MariaDB` reports `Running`) or run `docker compose up -d db` if Docker is available.
3. Run `npm install`.
4. Run `npm run db:setup` to apply checked-in migrations and load development seed data.
5. Run `npm run dev` and open `http://localhost:5173`.

The development seed creates a local-only demonstration account. Never run `db:seed` against a production database; create production users through registration or the owner-only Account Settings user manager.

`OPENAI_API_KEY` is optional for non-generation features. To enable article and social generation, create a project API key in the OpenAI Platform, set `OPENAI_API_KEY=your_key` in the root `.env`, and restart `npm run dev`. Keep the key server-side, never place it in frontend code, and never commit `.env`. `OPENAI_MODEL` selects an account-accessible model that supports Structured Outputs. API usage is billed through the API Platform separately from a ChatGPT subscription.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run API and web development servers |
| `npm run build` | Build all workspaces |
| `npm test` | Run automated tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check all TypeScript workspaces |
| `npm run db:setup` | Apply checked-in migrations and seed a new local database |
| `npm run db:deploy` | Apply checked-in migrations without requiring shadow-database privileges |
| `npm run db:migrate` | Create migrations during schema development (requires permission to create a shadow database) |
| `npm run db:seed` | Seed the two example businesses |

## Account access

- Visitors can create an account from the sign-in screen.
- A new account is guided to create its first business instead of entering an empty dashboard.
- Business owners can create users or add existing accounts from **Account Settings** and assign Manager, Editor or Viewer access.
- Users can change their own name, login email and password.
- **Forgot password** sends a single-use, time-limited link through configured SMTP. In local development without SMTP, the link is shown only in the local UI and API log.
- Password changes and resets invalidate older sessions. Passwords and reset tokens are never stored in plain text.

For deployment prerequisites, email configuration, migrations, health checks and operational checks, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## QR Code Generator contacts

The QR generator can import submitted contact forms through `POST /api/integrations/qr-code-generator/contacts`, authenticated with a business-scoped bearer integration token. Imports store the contact name, business name, email and website; match normalized emails; fill missing fields; and respect suppressed contacts. Imports do not send messages or start campaigns.

Apply database migrations and restart the API before connecting the generator. Run `node scripts/connect-qr-generator.mjs BUSINESS_UUID ABSOLUTE_PRIVATE_DIRECTORY [API_URL]` to create a token and save its configuration directly in the generator's private contact-storage directory. The token is not printed. Use HTTPS for remote API URLs. The QR generator's README documents the retry scheduler and deployment configuration.

## Lead Opportunities

The Lead Opportunities workspace provides a controlled outreach workflow:

1. Capture a public post URL and its exact text.
2. Detect previously captured source URLs for the selected business.
3. Write a reply manually or generate a business-aware AI suggestion.
4. Save immutable revisions and submit the current revision for review.
5. Approve or reject that exact revision as an owner or manager.
6. Post manually on the source platform and record the response evidence.

Approval does not publish externally. Automated discovery and social posting require separate authorised platform connectors and are not enabled in this release.

## Implemented milestone

Authentication, password recovery, owner-managed business users, multi-business profiles, business switching, first-business onboarding, lead capture and duplicate prevention, versioned lead replies and exact-revision approval, manual-publication records, crawl persistence, deterministic SEO checks and internal health score, current-audit comparison/history, AI visual-consistency audits using desktop/mobile browser captures, actionable SEO content and platform-specific instructions, guarded website-change preparation, WordPress connection verification with encrypted Application Password storage, automation preferences, dashboard, content library, scheduling API/calendar, Approvals & Actions decision queue, activity logging, structured AI article/social/lead-reply generation, validation, migrations, health/readiness checks, and Puzzle Path/VitaePro development records.

AI output remains a draft until it is reviewed. A separate WordPress staging copy can be connected, tested and disconnected using an encrypted, revocable Application Password; normal CMS administrator passwords are never requested. Development-only XAMPP targets may use localhost. Supported staging changes perform conflict detection and post-write verification, while live-site execution remains blocked server-side.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
