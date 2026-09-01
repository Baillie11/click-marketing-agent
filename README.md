# Click Marketing Agent

A business-agnostic, multi-business marketing workspace for website auditing, SEO recommendations, AI-assisted content, scheduling, and human approval workflows.

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

Seed login: `demo@clickmarketingagent.local` / `ChangeMe123!`. Change this password outside local development.

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

## Implemented milestone

Authentication, multi-business profiles, business switching, crawl persistence, deterministic SEO checks and internal health score, current-audit comparison/history, actionable SEO content and platform-specific instructions, guarded website-change preparation, automation preferences, dashboard, content library, scheduling API/calendar, Approvals & Actions decision queue, activity logging, structured AI article/social generation, validation, migrations, and Puzzle Path/VitaePro development records.

AI output remains a draft until it is reviewed. Website changes can be prepared and tracked, but live publishing and the automatic mode remain locked until a verified provider connector is implemented. The application does not store normal CMS admin passwords; future connectors must use revocable tokens and least-privilege permissions.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
