# Architecture

## Domain boundaries

`Business` is the tenant boundary. `BusinessMember` authorises users for one or more businesses. Website, crawl, page, issue, recommendation, content, plan, brand voice, and activity records all resolve through a business. Puzzle Path and VitaePro exist only in the seed script.

## Data model

- Identity: `User`, `Business`, `BusinessMember`
- Business context: `BrandVoice`, `Website`
- Audit: `WebsiteCrawl`, `WebsitePage`, `WebsiteLink`, `SeoIssue`
- Work: `Recommendation`, `ContentItem`, `MarketingPlan`, `MarketingPlanItem`
- Audit trail: `ActivityLog`

JSON fields are used for naturally bounded lists and AI metadata; queryable relationships remain relational. Archiving preserves business history.

## REST surface

- `/api/auth/*` — register, login, logout, current user
- `/api/businesses/*` — business CRUD, dashboard, crawls, pages, SEO
- `/api/content/*` — content library and approval state
- `/api/calendar` — scheduled content
- `/api/recommendations/*` — prepared changes and cross-channel approval/action decisions
- `/api/ai/article`, `/api/ai/social` — validated draft generation

Authentication is an HTTP-only, same-site JWT cookie. Sensitive auth endpoints are rate-limited. Every tenant-scoped route verifies membership.

## Crawl safety and limits

Only HTTP(S) is accepted. Credentials and localhost are rejected. DNS is resolved before every request and private, loopback, link-local, and carrier-grade NAT addresses are blocked. Redirects are handled manually and followed only on the original domain. Crawls deduplicate normalised URLs, remove tracking parameters, cap pages at 100, cap response text, and enforce timeouts.

The current crawler runs within an API request for a simple first milestone. A production scale-up should move it to a durable job worker while preserving the service contract.

## SEO score

The user-facing **Technical audit health** score starts at 100 and deducts points per unique check type rather than per raw finding. Severity sets the maximum weight (critical 18, high 12, medium 7, low 3), while the proportion of audited pages affected scales that weight from 50% for an isolated occurrence to 100% when every page is affected. This gives repeated site-wide problems appropriate influence without allowing duplication alone to dominate the score. The API returns the label, pages audited, unique checks and severity breakdown. It is explicitly not a Google ranking, traffic, conversion or overall business-quality score.

Each audit is an immutable snapshot. The Website & SEO response selects only the latest completed crawl for the current finding count and compares stable URL/check keys with the previous completed crawl. Historical issues are retained for trend reporting and are never added to the latest count. A second crawl is rejected while one is queued or running.

## Guarded website changes

Each website stores an automation mode and an allow-list of change categories. The live `baseUrl` remains the audit source while `stagingBaseUrl` is a separate execution target. The WordPress connector verifies a dedicated Application Password against the staging REST API, stores it with AES-256-GCM encryption, supports retesting, and deletes the encrypted credential on disconnect. Localhost targets are accepted only in development, the staging hostname must differ from the live hostname, and all execution routes independently reject non-staging connections. Before writing, the adapter re-reads the target field and rejects stale proposals; after writing, it reads the field again and records verification evidence. Live publishing remains disabled.

## Visual consistency audits

Visual audits use the URLs from the latest completed crawl, prioritise the home, About and Contact pages, and cap each run with `VISUAL_AUDIT_MAX_PAGES`. A locally installed Chrome or Edge browser captures each selected page at desktop and mobile viewport sizes. The OpenAI Responses API compares those labelled screenshots using a strict structured-output schema. Results are stored separately from technical SEO findings because the visual score is an evidence-led design consistency assessment, not a search-ranking or technical-health score. Screenshots are processed in memory and are not retained in the database.

## Content Library workflow

Content belongs to the selected business and moves through `IDEA`, `DRAFT`, `NEEDS_REVIEW`, `APPROVED`, `PUBLISHED`, or `REJECTED`. Users can generate article or social drafts, open and edit each item, update its workflow status, and assign a calendar date. Approval and scheduling are internal planning actions only; they do not publish to a website or social platform. `PUBLISHED` is currently a manual record that the user sets after external publication.
