import * as cheerio from 'cheerio';
import { db } from '../db.js';
import { assertSafePublicUrl, normaliseUrl, sameDomain } from '../lib/url.js';
import { detectPageIssues, healthScore } from './seo.js';
import { logActivity } from './activity.js';

export class CrawlerService {
  constructor(private readonly timeoutMs = 10000) {}

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
        const url = queue.shift()!;
        if (seen.has(url)) continue;
        seen.add(url);
        await assertSafePublicUrl(url); // DNS rebinding protection on every request.
        const response = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            'user-agent': 'ClickMarketingAgentBot/0.1 (+site audit requested by account owner)',
            accept: 'text/html,application/xhtml+xml',
          },
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            const target = normaliseUrl(location, url);
            if (sameDomain(target, business.websiteUrl)) queue.push(target);
          }
        }
        const contentType = response.headers.get('content-type') ?? '';
        const html = contentType.includes('text/html')
          ? (await response.text()).slice(0, 5_000_000)
          : '';
        const $ = cheerio.load(html);
        $('script,style,noscript,template').remove();
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const links = $('a[href]')
          .map((_, el) => ({
            targetUrl: normaliseUrl($(el).attr('href')!, url),
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
            url,
            statusCode: response.status,
            title: $('title').first().text().trim() || null,
            metaDescription: $('meta[name="description"]').attr('content')?.trim() || null,
            canonicalUrl: $('link[rel="canonical"]').attr('href')
              ? normaliseUrl($('link[rel="canonical"]').attr('href')!, url)
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
      const pages = await db.websitePage.findMany({ where: { crawlId: crawl.id } });
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
