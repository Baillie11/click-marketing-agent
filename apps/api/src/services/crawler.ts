import * as cheerio from 'cheerio';
import { db } from '../db.js';
import { assertSafePublicUrl, normaliseUrl, sameDomain } from '../lib/url.js';
import { detectPageIssues, healthScore } from './seo.js';
import { logActivity } from './activity.js';
import { getPublisher } from './publishers.js';
import { WordPressPublisher } from './wordpress-connector.js';

export class CrawlerService {
  constructor(
    private readonly timeoutMs = 10000,
    private readonly encryptionKey?: string,
  ) {}

  async crawl(businessId: string, requestedMax = 50) {
    const business = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { website: true },
    });
    await assertSafePublicUrl(business.websiteUrl);
    const website =
      business.website ??
      (await db.website.create({ data: { businessId, baseUrl: business.websiteUrl } }));
    const activeCrawl = await db.websiteCrawl.findFirst({
      where: { websiteId: website.id, status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (activeCrawl) {
      const error = new Error('A website audit is already running for this business');
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    // Pre-scan cache purge if WordPress is connected
    if (website.connectionStatus === 'CONNECTED' && website.connectionTarget === 'LIVE' && this.encryptionKey) {
      try {
        const publisher = await getPublisher(website.id, this.encryptionKey);
        if (publisher instanceof WordPressPublisher) {
          await publisher.purgeCache();
        }
      } catch {
        // Continue crawl even if purge fails
      }
    }

    const crawl = await db.websiteCrawl.create({
      data: { websiteId: website.id, status: 'RUNNING', startedAt: new Date() },
    });
    await logActivity('crawl.started', {
      businessId,
      entityType: 'WebsiteCrawl',
      entityId: crawl.id,
    });
    const queue = [normaliseUrl(business.websiteUrl)];
    const seen = new Set<string>();
    const maxPages = Math.min(requestedMax, 100);
    try {
      while (queue.length && seen.size < maxPages) {
        const rawUrl = queue.shift()!;
        const url = normaliseUrl(rawUrl);
        if (seen.has(url)) continue;
        seen.add(url);

        // Follow redirects hop-by-hop so every request is DNS-checked, fetching
        // exactly the URL the server returns. CMSs like WordPress 301-redirect
        // normalised URLs back to a canonical form (e.g. trailing slash), so the
        // redirect target must be fetched as-is rather than re-normalised.
        let response: Response | null = null;
        let pageUrl = url;
        try {
          let fetchTarget: string | null = url;
          for (let hop = 0; hop < 5 && fetchTarget; hop++) {
            await assertSafePublicUrl(fetchTarget); // DNS rebinding protection on every request.
            const res: Response = await fetch(fetchTarget, {
              redirect: 'manual',
              signal: AbortSignal.timeout(this.timeoutMs),
              headers: {
                'user-agent':
                  'ClickMarketingAgentBot/0.1 (+site audit requested by account owner)',
                'cache-control': 'no-cache, no-store, must-revalidate, max-age=0',
                'pragma': 'no-cache',
                accept: 'text/html,application/xhtml+xml',
              },
            });
            if (res.status < 300 || res.status >= 400) {
              response = res;
              pageUrl = normaliseUrl(fetchTarget);
              break;
            }
            const location = res.headers.get('location');
            if (!location) break;
            const absolute = new URL(location, fetchTarget).toString();
            const target = normaliseUrl(absolute);
            if (
              !sameDomain(absolute, business.websiteUrl) ||
              (target !== normaliseUrl(fetchTarget) && seen.has(target))
            )
              break;
            fetchTarget = absolute;
            pageUrl = target;
          }
        } catch {
          continue; // Skip unreachable pages without failing the whole audit.
        }
        if (!response) continue;
        if (pageUrl !== url && seen.has(pageUrl)) continue; // Redirect target already crawled.
        seen.add(pageUrl);

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html')) continue;

        const html = (await response.text()).slice(0, 5_000_000);
        const $ = cheerio.load(html);
        $('script,style,noscript,template').remove();
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const links = $('a[href]')
          .map((_, el) => ({
            targetUrl: normaliseUrl($(el).attr('href')!, pageUrl),
            anchorText: $(el).text().trim().slice(0, 1000),
          }))
          .get()
          .filter((link) => ['http:', 'https:'].includes(new URL(link.targetUrl).protocol));
        const internal = links.filter((link) => sameDomain(link.targetUrl, business.websiteUrl));
        for (const link of internal)
          if (!seen.has(link.targetUrl) && queue.length < maxPages * 4) queue.push(link.targetUrl);
        const openGraph: Record<string, string> = {};
        $('meta[property^="og:"]').each((_, el) => {
          const property = $(el).attr('property');
          const content = $(el).attr('content');
          if (property && content) openGraph[property] = content;
        });
        const page = await db.websitePage.create({
          data: {
            websiteId: website.id,
            crawlId: crawl.id,
            url: pageUrl,
            statusCode: response.status,
            title: $('title').first().text().trim().slice(0, 512) || null,
            metaDescription: $('meta[name="description"]').attr('content')?.trim() || null,
            canonicalUrl: $('link[rel="canonical"]').attr('href')
              ? normaliseUrl($('link[rel="canonical"]').attr('href')!, pageUrl).slice(0, 2048)
              : null,
            h1: $('h1')
              .map((_, el) => $(el).text().trim())
              .get(),
            h2: $('h2')
              .map((_, el) => $(el).text().trim())
              .get(),
            h3: $('h3')
              .map((_, el) => $(el).text().trim())
              .get(),
            visibleText: text,
            wordCount: text ? text.split(/\s+/).length : 0,
            images: $('img')
              .map((_, el) => ({ src: $(el).attr('src') ?? '', alt: $(el).attr('alt') ?? '' }))
              .get(),
            openGraph,
          },
        });
        if (links.length)
          await db.websiteLink.createMany({
            data: links.map((link) => ({
              fromPageId: page.id,
              ...link,
              isInternal: sameDomain(link.targetUrl, business.websiteUrl),
            })),
          });
      }
      const pages = await db.websitePage.findMany({
        where: { crawlId: crawl.id, statusCode: { gte: 200, lt: 300 } },
      });
      const detected = pages.flatMap(detectPageIssues);
      if (detected.length)
        await db.seoIssue.createMany({
          data: detected.map(({ code, ...issue }) => ({
            ...issue,
            businessId,
            fingerprint: `${crawl.id}:${issue.pageId}:${code}`,
          })),
        });
      const score = healthScore(detected, pages.length);
      await db.$transaction([
        db.websiteCrawl.update({
          where: { id: crawl.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            pagesFound: seen.size + queue.length,
            pagesCrawled: pages.length,
          },
        }),
        db.website.update({
          where: { id: website.id },
          data: { lastCrawledAt: new Date(), healthScore: score },
        }),
      ]);
      await logActivity('crawl.completed', {
        businessId,
        entityType: 'WebsiteCrawl',
        entityId: crawl.id,
        metadata: { pages: pages.length, score },
      });
      return {
        crawlId: crawl.id,
        pages: pages.length,
        issues: detected.length,
        healthScore: score,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown crawl error';
      await db.websiteCrawl.update({
        where: { id: crawl.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: message,
          pagesCrawled: seen.size,
        },
      });
      await logActivity('crawl.failed', {
        businessId,
        entityType: 'WebsiteCrawl',
        entityId: crawl.id,
        metadata: { message },
      });
      throw error;
    }
  }
}
