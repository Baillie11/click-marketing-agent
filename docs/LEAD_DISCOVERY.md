# Lead discovery

Lead discovery searches the public web for genuine posts that match a business-specific search profile. It never posts replies. Every discovered result retains its public source URL and enters the existing human review workflow.

## Business setup

In **Lead Opportunities**, choose **Configure discovery** and define:

- platforms to search;
- specific services, topics and customer problems;
- buyer-intent phrases;
- locations and excluded terms;
- manual, daily or weekly frequency; and
- the maximum number of results per scan.

Choose **Find opportunities now** for an immediate scan. Results are deduplicated by canonical source identity. Unsupported, inaccessible or uncited results are discarded.

## Scheduled scans

Set a unique `LEAD_DISCOVERY_CRON_SECRET` in the production environment. Configure the hosting scheduler to send an authenticated `POST` request to `/api/internal/lead-discovery/run-due` at least hourly:

```sh
curl --fail --silent --show-error \
  -X POST \
  -H "Authorization: Bearer $LEAD_DISCOVERY_CRON_SECRET" \
  https://your-app.example/api/internal/lead-discovery/run-due
```

The endpoint processes up to three due profiles per call. The secret must remain server-side and must never be placed in frontend code.

## Safety and evidence

- Search is limited to publicly accessible web sources.
- A result must be backed by a URL returned as an OpenAI web-search citation.
- Private groups, login-only pages, advertisements and business-owned pages are excluded by instruction.
- Discovery creates review items only. Reply generation, approval and publication remain separate steps.
- Daily and weekly scans use the same duplicate protections as manual capture.

The implementation follows the official OpenAI Responses API web-search guidance: <https://developers.openai.com/api/docs/guides/tools-web-search>.
