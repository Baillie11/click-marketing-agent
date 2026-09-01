import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  businessSchema,
  contentSchema,
  contentTransitionSchema,
  crawlRequestSchema,
  generateArticleSchema,
  generateSocialSchema,
  loginSchema,
  registerSchema,
} from '@click/shared';
import { db } from './db.js';
import type { Config } from './config.js';
import { slugify } from './lib/slug.js';
import { CrawlerService } from './services/crawler.js';
import { AiService } from './services/ai.js';
import { logActivity } from './services/activity.js';
import { createRuleBasedSeoSuggestion } from './services/seo-suggestion.js';
import { getPublisher } from './services/publishers.js';
import { compareAuditIssues } from './services/audit-comparison.js';
import { calculateHealthScore } from './services/seo.js';
import { publicAiError } from './services/ai-errors.js';

const serialiseBusiness = (b: any) => ({
  ...b,
  secondaryGoals: b.secondaryGoals ?? [],
  keywords: b.keywords ?? [],
});

export const buildApp = async (config: Config) => {
  const app = Fastify({
    logger: config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true,
  });
  await app.register(helmet);
  await app.register(cookie);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: 'click_session', signed: false },
    sign: { expiresIn: config.JWT_EXPIRES_IN as any },
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  const requireAuth = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Authentication required' });
    }
  };
  const owns = async (userId: string, businessId: string) =>
    Boolean(
      await db.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } }),
    );
  const ai = config.OPENAI_API_KEY
    ? new AiService(config.OPENAI_API_KEY, config.OPENAI_MODEL)
    : null;

  app.get('/api/health', async () => ({ status: 'ok', version: '0.1.0' }));
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      try {
        const user = await db.user.create({
          data: { name: input.name, email: input.email, passwordHash },
        });
        const token = await reply.jwtSign({ sub: user.id });
        reply.setCookie('click_session', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.NODE_ENV === 'production',
          path: '/',
          maxAge: 28800,
        });
        return reply.code(201).send({ user: { id: user.id, name: user.name, email: user.email } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
          return reply.code(409).send({ error: 'An account already exists for this email' });
        throw e;
      }
    },
  );
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (!user || !(await argon2.verify(user.passwordHash, input.password)))
        return reply.code(401).send({ error: 'Invalid email or password' });
      const token = await reply.jwtSign({ sub: user.id });
      reply.setCookie('click_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        path: '/',
        maxAge: 28800,
      });
      return { user: { id: user.id, name: user.name, email: user.email } };
    },
  );
  app.post('/api/auth/logout', async (_, reply) =>
    reply.clearCookie('click_session', { path: '/' }).code(204).send(),
  );
  app.get('/api/auth/me', { preHandler: requireAuth }, async (request: any) =>
    db.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, name: true, email: true },
    }),
  );

  app.get('/api/businesses', { preHandler: requireAuth }, async (request: any) =>
    (
      await db.business.findMany({
        where: { members: { some: { userId: request.user.sub } }, archivedAt: null },
        include: { website: true },
        orderBy: { name: 'asc' },
      })
    ).map(serialiseBusiness),
  );
  app.post('/api/businesses', { preHandler: requireAuth }, async (request: any, reply) => {
    const input = businessSchema.parse(request.body);
    let slug = slugify(input.name);
    if (await db.business.findUnique({ where: { slug } })) slug += `-${Date.now()}`;
    const business = await db.business.create({
      data: {
        ...input,
        slug,
        members: { create: { userId: request.user.sub, role: 'OWNER' } },
        website: { create: { baseUrl: input.websiteUrl } },
        brandVoice: {
          create: {
            tone: input.brandTone,
            preferredPhrases: [],
            prohibitedPhrases: [],
            targetCustomer: input.targetAudience,
            ctaStyle: input.mainCta,
            instructions: '',
          },
        },
      },
    });
    return reply.code(201).send(serialiseBusiness(business));
  });
  app.get('/api/businesses/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await owns(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    return serialiseBusiness(
      await db.business.findUniqueOrThrow({
        where: { id: request.params.id },
        include: { brandVoice: true, website: true },
      }),
    );
  });
  app.put('/api/businesses/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await owns(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    return serialiseBusiness(
      await db.business.update({
        where: { id: request.params.id },
        data: businessSchema.parse(request.body),
      }),
    );
  });
  app.delete('/api/businesses/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await owns(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    await db.business.update({
      where: { id: request.params.id },
      data: { archivedAt: new Date() },
    });
    return reply.code(204).send();
  });

  app.post(
    '/api/businesses/:id/crawls',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await owns(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const input = crawlRequestSchema.parse(request.body ?? {});
      return new CrawlerService(config.CRAWLER_TIMEOUT_MS).crawl(
        request.params.id,
        input.maxPages ?? config.CRAWLER_MAX_PAGES,
      );
    },
  );
  app.get('/api/businesses/:id/pages', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await owns(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    return db.websitePage.findMany({
      where: { website: { businessId: request.params.id }, crawl: { status: 'COMPLETED' } },
      select: {
        id: true,
        url: true,
        statusCode: true,
        title: true,
        metaDescription: true,
        h1: true,
        wordCount: true,
        fetchedAt: true,
      },
      orderBy: { fetchedAt: 'desc' },
      take: 200,
    });
  });
  app.get('/api/businesses/:id/seo', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await owns(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    const business = await db.business.findUniqueOrThrow({
      where: { id: request.params.id },
      include: { website: true },
    });
    const crawls = business.website
      ? await db.websiteCrawl.findMany({
          where: { websiteId: business.website.id, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 20,
        })
      : [];
    const latest = crawls[0];
    const previous = crawls[1];
    const pageSelect = {
      url: true,
      title: true,
      metaDescription: true,
      h1: true,
      h2: true,
      wordCount: true,
      images: true,
    } as const;
    const [issues, previousIssues, suggestions, history] = await Promise.all([
      latest
        ? db.seoIssue.findMany({
            where: { businessId: request.params.id, page: { crawlId: latest.id } },
            include: { page: { select: pageSelect } },
            orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([]),
      previous
        ? db.seoIssue.findMany({
            where: { businessId: request.params.id, page: { crawlId: previous.id } },
            include: { page: { select: { url: true } } },
          })
        : Promise.resolve([]),
      db.recommendation.findMany({
        where: { businessId: request.params.id, source: { startsWith: 'SEO_ISSUE:' } },
        orderBy: { updatedAt: 'desc' },
      }),
      Promise.all(
        crawls.map(async (crawl) => ({
          id: crawl.id,
          startedAt: crawl.startedAt,
          completedAt: crawl.completedAt,
          pagesCrawled: crawl.pagesCrawled,
          issueCount: await db.seoIssue.count({
            where: { businessId: request.params.id, page: { crawlId: crawl.id } },
          }),
        })),
      ),
    ]);
    const latestByIssue = new Map<string, (typeof suggestions)[number]>();
    for (const suggestion of suggestions) {
      const issueId = suggestion.source.replace('SEO_ISSUE:', '');
      if (!latestByIssue.has(issueId)) latestByIssue.set(issueId, suggestion);
    }
    const comparison = compareAuditIssues(issues, previousIssues);
    const health = calculateHealthScore(issues, latest?.pagesCrawled ?? 0);
    return {
      healthScore: latest ? health.score : null,
      healthBreakdown: latest ? health : null,
      currentCrawl: latest ?? null,
      comparison,
      history,
      issues: issues.map((issue) => ({
        ...issue,
        suggestion: latestByIssue.get(issue.id) ?? null,
      })),
    };
  });
  app.post('/api/seo/:id/suggestion', { preHandler: requireAuth }, async (request: any, reply) => {
    const issue = await db.seoIssue.findFirst({
      where: {
        id: request.params.id,
        business: { members: { some: { userId: request.user.sub } } },
      },
      include: { page: true, business: true },
    });
    if (!issue || !issue.page)
      return reply.code(404).send({ error: 'SEO issue or affected page not found' });

    const fallback = createRuleBasedSeoSuggestion({
      business: issue.business,
      issue,
      page: issue.page,
    });
    let generated: {
      targetField: string;
      proposedValue: string;
      rationale: string;
      source: string;
    } = fallback;
    if (ai) {
      try {
        const result = await ai.seoSuggestion(issue.businessId, issue, issue.page);
        generated = { ...result, source: 'OPENAI' };
      } catch (error) {
        app.log.warn(
          { error, issueId: issue.id },
          'AI SEO suggestion failed; using rule-based suggestion',
        );
      }
    }

    const currentValue = (() => {
      const finding = issue.title.toLowerCase();
      if (finding.includes('meta description')) return issue.page.metaDescription;
      if (finding.includes('title')) return issue.page.title;
      if (finding.includes('h1')) return JSON.stringify(issue.page.h1);
      return null;
    })();
    const recommendation = await db.recommendation.create({
      data: {
        businessId: issue.businessId,
        pageId: issue.pageId,
        source: `SEO_ISSUE:${issue.id}`,
        category: issue.category,
        severity: issue.severity,
        title: `${generated.targetField} suggestion`,
        description: `${generated.rationale} (${generated.source === 'OPENAI' ? 'AI-assisted' : 'Generated from business and page context'}.)`,
        currentValue,
        proposedValue: generated.proposedValue,
        status: 'OPEN',
      },
    });
    await logActivity('seo.suggestion_generated', {
      businessId: issue.businessId,
      userId: request.user.sub,
      entityType: 'Recommendation',
      entityId: recommendation.id,
      metadata: { issueId: issue.id, source: generated.source },
    });
    return reply
      .code(201)
      .send({
        ...recommendation,
        targetField: generated.targetField,
        generationSource: generated.source,
      });
  });
  app.patch('/api/seo/:id/status', { preHandler: requireAuth }, async (request: any, reply) => {
    const issue = await db.seoIssue.findFirst({
      where: {
        id: request.params.id,
        business: { members: { some: { userId: request.user.sub } } },
      },
    });
    if (!issue) return reply.code(404).send({ error: 'SEO issue not found' });
    const { status } = z
      .object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'DISMISSED', 'COMPLETED']) })
      .parse(request.body);
    const updated = await db.seoIssue.update({ where: { id: issue.id }, data: { status } });
    await logActivity(`seo.${status.toLowerCase()}`, {
      businessId: issue.businessId,
      userId: request.user.sub,
      entityType: 'SeoIssue',
      entityId: issue.id,
    });
    return updated;
  });
  app.get('/api/businesses/:id/automation', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await owns(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    const website = await db.website.findUniqueOrThrow({ where: { businessId: request.params.id } });
    const changes = await db.websiteChange.findMany({
      where: { websiteId: website.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      mode: website.automationMode,
      rules: website.automationRules ?? {
        seoTitles: true,
        metaDescriptions: true,
        imageAltText: false,
        headings: false,
        internalLinks: false,
        pageCopy: false,
      },
      connection: {
        provider: website.connectionProvider,
        status: website.connectionStatus,
        publisherReady: Boolean(getPublisher(website.id)),
      },
      changes,
    };
  });
  app.put('/api/businesses/:id/automation', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await owns(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    const input = z.object({
      mode: z.enum(['RECOMMEND_ONLY', 'APPROVAL_REQUIRED', 'AUTO_LOW_RISK']),
      provider: z.enum(['NONE', 'WORDPRESS', 'SHOPIFY', 'CUSTOM']).optional(),
      rules: z.object({
        seoTitles: z.boolean(),
        metaDescriptions: z.boolean(),
        imageAltText: z.boolean(),
        headings: z.boolean(),
        internalLinks: z.boolean(),
        pageCopy: z.boolean(),
      }),
    }).parse(request.body);
    const website = await db.website.findUniqueOrThrow({ where: { businessId: request.params.id } });
    if (input.mode === 'AUTO_LOW_RISK' && website.connectionStatus !== 'CONNECTED') {
      return reply.code(409).send({
        error: 'Connect and verify the website before enabling automatic changes',
      });
    }
    const updated = await db.website.update({
      where: { id: website.id },
      data: {
        automationMode: input.mode,
        automationRules: input.rules,
        ...(input.provider ? { connectionProvider: input.provider } : {}),
      },
    });
    await logActivity('website.automation_settings_updated', {
      businessId: request.params.id,
      userId: request.user.sub,
      entityType: 'Website',
      entityId: website.id,
      metadata: { mode: input.mode, rules: input.rules },
    });
    return {
      mode: updated.automationMode,
      rules: updated.automationRules,
      connection: {
        provider: updated.connectionProvider,
        status: updated.connectionStatus,
        publisherReady: Boolean(getPublisher(updated.id)),
      },
      changes: await db.websiteChange.findMany({
        where: { websiteId: updated.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    };
  });
  app.post('/api/seo/:id/prepare-change', { preHandler: requireAuth }, async (request: any, reply) => {
    const input = z.object({
      recommendationId: z.string().uuid(),
      targetField: z.string().min(2).max(100),
      proposedValue: z.string().min(1),
    }).parse(request.body);
    const issue = await db.seoIssue.findFirst({
      where: { id: request.params.id, business: { members: { some: { userId: request.user.sub } } } },
      include: { page: true, business: { include: { website: true } } },
    });
    if (!issue?.page || !issue.business.website)
      return reply.code(404).send({ error: 'SEO issue or website not found' });
    const recommendation = await db.recommendation.findFirst({
      where: { id: input.recommendationId, businessId: issue.businessId },
    });
    if (!recommendation) return reply.code(404).send({ error: 'Suggestion not found' });
    const change = await db.websiteChange.create({
      data: {
        websiteId: issue.business.website.id,
        seoIssueId: issue.id,
        recommendationId: recommendation.id,
        targetUrl: issue.page.url,
        targetField: input.targetField,
        beforeValue: recommendation.currentValue,
        proposedValue: input.proposedValue,
        status: 'PROPOSED',
      },
    });
    await logActivity('website.change_prepared', {
      businessId: issue.businessId,
      userId: request.user.sub,
      entityType: 'WebsiteChange',
      entityId: change.id,
    });
    return reply.code(201).send(change);
  });
  app.post('/api/website-changes/:id/apply', { preHandler: requireAuth }, async (request: any, reply) => {
    const change = await db.websiteChange.findFirst({
      where: {
        id: request.params.id,
        website: { business: { members: { some: { userId: request.user.sub } } } },
      },
      include: { website: { include: { business: true } } },
    });
    if (!change) return reply.code(404).send({ error: 'Prepared change not found' });
    if (change.website.connectionStatus !== 'CONNECTED')
      return reply.code(409).send({ error: 'The website is not connected for publishing' });
    const publisher = getPublisher(change.websiteId);
    if (!publisher)
      return reply.code(409).send({ error: 'No verified publishing connector is available for this website yet' });
    return reply.code(501).send({ error: 'Publishing adapter execution is not enabled' });
  });
  app.get(
    '/api/businesses/:id/dashboard',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await owns(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const businessId = request.params.id;
      const website = await db.website.findUnique({ where: { businessId } });
      const latestCrawl = website
        ? await db.websiteCrawl.findFirst({
            where: { websiteId: website.id, status: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
          })
        : null;
      const [business, pages, issues, drafts, planned, inbox, content] = await Promise.all([
        db.business.findUniqueOrThrow({ where: { id: businessId }, include: { website: true } }),
        latestCrawl
          ? db.websitePage.count({ where: { crawlId: latestCrawl.id } })
          : Promise.resolve(0),
        latestCrawl
          ? db.seoIssue.findMany({ where: { businessId, page: { crawlId: latestCrawl.id } } })
          : Promise.resolve([]),
        db.contentItem.count({ where: { businessId, status: { in: ['DRAFT', 'NEEDS_REVIEW'] } } }),
        db.contentItem.count({ where: { businessId, scheduledAt: { not: null } } }),
        db.recommendation.count({
          where: {
            businessId,
            source: { not: 'ONBOARDING' },
            proposedValue: { not: null },
            status: { in: ['OPEN', 'IN_PROGRESS', 'APPROVED'] },
          },
        }),
        db.contentItem.findMany({ where: { businessId }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      ]);
      const health = latestCrawl ? calculateHealthScore(issues, pages) : null;
      return {
        business: serialiseBusiness(business),
        metrics: {
          pages,
          issues: issues.length,
          drafts,
          planned,
          inbox,
          healthScore: health?.score ?? null,
          healthBreakdown: health,
        },
        recentContent: content,
      };
    },
  );

  app.get('/api/content', { preHandler: requireAuth }, async (request: any) => {
    const q = request.query as any;
    return db.contentItem.findMany({
      where: {
        businessId: q.businessId,
        business: { members: { some: { userId: request.user.sub } } },
        ...(q.status ? { status: q.status } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.search
          ? { OR: [{ title: { contains: q.search } }, { body: { contains: q.search } }] }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  });
  app.post('/api/content', { preHandler: requireAuth }, async (request: any, reply) => {
    const input = contentSchema.parse(request.body);
    if (!(await owns(request.user.sub, input.businessId)))
      return reply.code(404).send({ error: 'Business not found' });
    return reply.code(201).send(
      await db.contentItem.create({
        data: { ...input, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null },
      }),
    );
  });
  app.patch('/api/content/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    const item = await db.contentItem.findFirst({
      where: {
        id: request.params.id,
        business: { members: { some: { userId: request.user.sub } } },
      },
    });
    if (!item) return reply.code(404).send({ error: 'Content not found' });
    const input = contentSchema.partial().parse(request.body);
    const { businessId: _businessId, scheduledAt, ...changes } = input;
    void _businessId;
    const data = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as Prisma.ContentItemUpdateInput;
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    return db.contentItem.update({
      where: { id: item.id },
      data,
    });
  });
  app.patch('/api/content/:id/status', { preHandler: requireAuth }, async (request: any, reply) => {
    const item = await db.contentItem.findFirst({
      where: {
        id: request.params.id,
        business: { members: { some: { userId: request.user.sub } } },
      },
    });
    if (!item) return reply.code(404).send({ error: 'Content not found' });
    const { status } = contentTransitionSchema.parse(request.body);
    const updated = await db.contentItem.update({ where: { id: item.id }, data: { status } });
    await logActivity(`content.${status.toLowerCase()}`, {
      businessId: item.businessId,
      userId: request.user.sub,
      entityType: 'ContentItem',
      entityId: item.id,
    });
    return updated;
  });
  app.get('/api/calendar', { preHandler: requireAuth }, async (request: any) => {
    const q = request.query as any;
    return db.contentItem.findMany({
      where: {
        businessId: q.businessId,
        scheduledAt: { not: null },
        business: { members: { some: { userId: request.user.sub } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  });
  app.get('/api/recommendations', { preHandler: requireAuth }, async (request: any) => {
    const q = request.query as any;
    return db.recommendation.findMany({
      where: {
        businessId: q.businessId,
        business: { members: { some: { userId: request.user.sub } } },
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
  });
  app.patch(
    '/api/recommendations/:id',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const item = await db.recommendation.findFirst({
        where: {
          id: request.params.id,
          business: { members: { some: { userId: request.user.sub } } },
        },
      });
      if (!item) return reply.code(404).send({ error: 'Recommendation not found' });
      const body = z.object({
        status: z.enum(['OPEN', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'DISMISSED', 'COMPLETED']),
        proposedValue: z.string().nullable().optional(),
      }).parse(request.body);
      const updated = await db.recommendation.update({
        where: { id: item.id },
        data: {
          status: body.status,
          ...(body.proposedValue !== undefined ? { proposedValue: body.proposedValue } : {}),
        },
      });
      await logActivity('recommendation.decision_updated', {
        businessId: item.businessId,
        userId: request.user.sub,
        entityType: 'Recommendation',
        entityId: item.id,
        metadata: { status: body.status },
      });
      return updated;
    },
  );
  app.post('/api/ai/article', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!ai) return reply.code(503).send({ error: 'AI generation is not configured' });
    const body = generateArticleSchema
      .extend({ businessId: z.string().uuid() })
      .parse(request.body);
    if (!(await owns(request.user.sub, body.businessId)))
      return reply.code(404).send({ error: 'Business not found' });
    const result = await ai.article(body.businessId, body.topic, body.audience, body.style);
    return reply.code(201).send(
      await db.contentItem.create({
        data: {
          businessId: body.businessId,
          title: result.suggestedTitle,
          type: 'SEO_ARTICLE',
          status: 'NEEDS_REVIEW',
          body: result.articleContent,
          metadata: result,
          tags: [result.primaryTopic],
          notes: 'AI-generated recommendation. Review before publishing.',
          aiGenerated: true,
        },
      }),
    );
  });
  app.get('/api/capabilities', { preHandler: requireAuth }, async () => ({
    aiGeneration: Boolean(ai),
  }));
  app.post('/api/ai/social', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!ai) return reply.code(503).send({ error: 'AI generation is not configured' });
    const body = generateSocialSchema.extend({ businessId: z.string().uuid() }).parse(request.body);
    if (!(await owns(request.user.sub, body.businessId)))
      return reply.code(404).send({ error: 'Business not found' });
    const result = await ai.social(body.businessId, body.topic);
    const items = await db.$transaction(
      [
        { type: 'FACEBOOK_POST', body: result.facebook },
        { type: 'LINKEDIN_POST', body: result.linkedin },
        { type: 'REDDIT_RESPONSE', body: result.reddit },
      ].map((x) =>
        db.contentItem.create({
          data: {
            businessId: body.businessId,
            title: `${body.topic} — ${x.type.replace('_', ' ')}`,
            type: x.type as any,
            status: 'NEEDS_REVIEW',
            body: x.body,
            tags: [body.topic],
            notes: 'AI-generated recommendation. Review before publishing.',
            aiGenerated: true,
          },
        }),
      ),
    );
    return reply.code(201).send(items);
  });

  app.setErrorHandler((error, _request, reply) => {
    const caught = error as Error & { statusCode?: number; issues?: unknown };
    if (caught.name === 'ZodError')
      return reply.code(400).send({ error: 'Validation failed', details: caught.issues });
    const aiError = publicAiError(error);
    if (aiError)
      return reply.code(aiError.statusCode).send({ error: aiError.message, actionUrl: aiError.actionUrl });
    app.log.error(error);
    return reply
      .code(caught.statusCode ?? 500)
      .send({ error: caught.statusCode ? caught.message : 'Internal server error' });
  });
  return app;
};
