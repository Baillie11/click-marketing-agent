# Production deployment

Click Marketing Agent runs as two deployable applications: the static React build in `apps/web/dist` and the Node/Fastify API in `apps/api/dist`. It requires a MySQL 8 or MariaDB 11-compatible database. Docker is optional.

## Required production configuration

Set these as host-managed environment variables; do not commit a production `.env` file:

- `NODE_ENV=production`
- `DATABASE_URL` — dedicated production database and least-privilege application user
- `JWT_SECRET` — unique random value of at least 32 characters
- `WEB_ORIGIN` — exact public frontend origin, for example `https://app.example.com`
- `APP_URL` — same public application base URL, used in password-reset links
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`
- `SMTP_USER` and `SMTP_PASSWORD` when the relay requires authentication
- `CONNECTOR_ENCRYPTION_KEY` — random 32-byte base64 value before CMS connectors are enabled
- `OPENAI_API_KEY` when AI generation or layout auditing is enabled

The API refuses to start in production without SMTP sender configuration or with the example JWT secret.

## Release procedure

1. Back up the database.
2. Install locked dependencies with `npm ci`.
3. Run `npm audit --omit=dev` and resolve production vulnerabilities.
4. Build with `npm run build`.
5. Apply checked-in migrations with `npm run db:deploy`. Do not run `db:migrate` or `db:seed` in production.
6. Serve `apps/web/dist` from the web host or CDN.
7. Start the API with `npm run start -w @click/api` under the hosting provider’s process manager.
8. Proxy browser requests beginning `/api` to the API and preserve HTTPS forwarding headers.
9. Confirm `/api/health` returns `status: ok` and `/api/ready` returns HTTP 200 with `database: ok`.

## Email and password recovery

Password recovery uses standard SMTP via Nodemailer. Use the SMTP details supplied by the transactional-email provider or hosting company. The reset response is intentionally identical whether or not an email exists, preventing account discovery. Tokens expire, are single-use, and only SHA-256 hashes are stored.

Test delivery from a non-production account after deployment. Configure SPF, DKIM and DMARC for the sender domain with the email provider to improve delivery.

## Reverse proxy and TLS

Terminate HTTPS at the hosting platform or reverse proxy. Redirect HTTP to HTTPS, forward `/api` to port 4000, serve the React application for other paths, and configure SPA fallback to `index.html`. The session cookie is HTTP-only, SameSite=Lax, and Secure in production.

## Operations

- Keep automated database backups with a tested restore procedure.
- Monitor API logs and alert when `/api/ready` fails.
- Rotate `JWT_SECRET`, SMTP credentials, OpenAI keys and connector encryption keys through the hosting platform’s secret manager.
- Do not copy the development database, demo account or `.env` file into production.
- Run migrations before starting each new release and retain the previous application build for rollback.
- Website crawling and visual audits currently execute in the API process. For larger customer volume, move them to a durable worker queue before increasing concurrency.

## Launch boundary

The V1 production boundary includes account and business management, audits, content workflows, password recovery and controlled staging WordPress fixes. Live-site automated writes, rankings, social publishing, paid advertising and autonomous marketing are intentionally deferred and should not be represented as available production features.
