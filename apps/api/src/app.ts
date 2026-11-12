import Fastify from 'fastify';
import { registerQrContactImport } from './services/qr-contact-import.js';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { hashPassword, verifyPassword } from './services/password.js';
import {
  businessSchema,
  contentSchema,
  contentTransitionSchema,
  crawlRequestSchema,
  generateArticleSchema,
  generateSocialSchema,
  loginSchema,
  registerSchema,
  accountProfileSchema,
  accountPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createWorkspaceUserSchema,
  captureLeadSchema,
  createLeadReplySchema,
  updateLeadReplySchema,
  leadDecisionSchema,
  manualPublicationSchema,
  outreachPolicySchema,
  leadDiscoveryProfileSchema,
  productVersion,
} from '@click/shared';
import { db } from './db.js';
import type { Config } from './config.js';
import { slugify } from './lib/slug.js';
import { CrawlerService } from './services/crawler.js';
import { AiService } from './services/ai.js';
import { logActivity, logActivityStrict } from './services/activity.js';
import { leadSourceIdentity, sha256 } from './services/lead-source-identity.js';
import { createRuleBasedSeoSuggestion } from './services/seo-suggestion.js';
import { getPublisher } from './services/publishers.js';
import { compareAuditIssues } from './services/audit-comparison.js';
import { calculateHealthScore } from './services/seo.js';
import { publicAiError } from './services/ai-errors.js';
import { decryptConnectorSecret, encryptConnectorSecret } from './services/connector-secret.js';
import { verifyWordPressConnection } from './services/wordpress-connector.js';
import { captureWebsiteLayouts, selectVisualAuditUrls } from './services/visual-capture.js';
import { stagingExecutionUrl, validateStagingTarget } from './services/staging-target.js';
import { EmailService } from './services/email.js';
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiry,
} from './services/password-reset.js';

const serialiseBusiness = (b: any) => ({
  ...b,
  secondaryGoals: b.secondaryGoals ?? [],
  keywords: b.keywords ?? [],
});

export const buildApp = async (config: Config) => {
  const app = Fastify({
    logger: config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true,
  });
  app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Please check the information supplied',
        fields: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    const aiError = publicAiError(error);
    if (aiError) {
      return reply
        .code(aiError.statusCode)
        .send({ error: aiError.message, actionUrl: aiError.actionUrl });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      request.log.error({ err: error, code: error.code }, 'Database request failed');
      return reply.code(500).send({ error: 'The request could not be completed' });
    }
    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode < 500 ? error.statusCode : 500;
    if (statusCode >= 500) request.log.error({ err: error }, 'Unhandled request error');
    return reply
      .code(statusCode)
      .send({ error: statusCode >= 500 ? 'Internal server error' : error.message });
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
      const user = await db.user.findUnique({
        where: { id: request.user.sub },
        select: { authVersion: true },
      });
      if (!user || (request.user.ver ?? 0) !== user.authVersion) {
        return reply.code(401).send({ error: 'Your session has expired. Please sign in again.' });
      }
    } catch {
      return reply.code(401).send({ error: 'Authentication required' });
    }
  };
  const owns = async (userId: string, businessId: string) =>
    Boolean(
      await db.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } }),
    );
  const membershipFor = (userId: string, businessId: string) =>
    db.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } });
  const hasRole = async (userId: string, businessId: string, roles: string[]) => {
    const membership = await membershipFor(userId, businessId);
    return Boolean(membership && roles.includes(membership.role));
  };
  const canEdit = (userId: string, businessId: string) =>
    hasRole(userId, businessId, ['OWNER', 'MANAGER', 'EDITOR']);
  const canManage = (userId: string, businessId: string) =>
    hasRole(userId, businessId, ['OWNER', 'MANAGER']);
  const isOwner = (userId: string, businessId: string) => hasRole(userId, businessId, ['OWNER']);
  const ai = config.OPENAI_API_KEY
    ? new AiService(config.OPENAI_API_KEY, config.OPENAI_MODEL)
    : null;
  const email = new EmailService(config);
  const connectionView = (website: any) => ({
    provider: website.connectionProvider,
    status: website.connectionStatus,
    publisherReady:
      website.connectionStatus === 'CONNECTED' && Boolean(config.CONNECTOR_ENCRYPTION_KEY),
    username: website.connectionUsername,
    verifiedAt: website.connectionVerifiedAt,
    error: website.connectionError,
    target: website.connectionTarget,
    baseUrl: website.connectionBaseUrl,
    stagingBaseUrl: website.stagingBaseUrl,
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    ...productVersion,
  }));
  app.get('/api/ready', async (_, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        checks: { database: 'ok', email: email.configured ? 'configured' : 'development-only' },
        ...productVersion,
      };
    } catch (error) {
      app.log.error({ err: error }, 'Readiness check failed');
      return reply
        .code(503)
        .send({ status: 'not-ready', checks: { database: 'failed' }, ...productVersion });
    }
  });
  app.post(
    '/api/integrations/mail-monitor/contacts',
    { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith('Bearer '))
        return reply.code(401).send({ error: 'Integration token required' });
      const tokenHash = createHash('sha256').update(authorization.slice(7).trim()).digest('hex');
      const integration = await db.integrationToken.findFirst({
        where: { tokenHash, revokedAt: null },
      });
      if (!integration) return reply.code(401).send({ error: 'Invalid integration token' });
      const input = z
        .object({
          businessId: z.string().uuid(),
          email: z.string().trim().email().max(255),
          contactName: z.string().trim().max(150).default(''),
          businessName: z.string().trim().max(150).default(''),
          contactNumber: z.string().trim().max(50).default(''),
          source: z.literal('click-mail-monitor'),
          sourceId: z.string().trim().min(1).max(255),
        })
        .parse(request.body);
      if (input.businessId !== integration.businessId)
        return reply.code(403).send({ error: 'Token is not authorised for this business' });
      const normalizedEmail = input.email.toLowerCase();
      const contact = await db.$transaction(async (tx) => {
        await tx.integrationToken.update({
          where: { id: integration.id },
          data: { lastUsedAt: new Date() },
        });
        const existing = await tx.contact.findUnique({
          where: { businessId_normalizedEmail: { businessId: input.businessId, normalizedEmail } },
        });
        if (existing?.suppressedAt) return existing;
        if (existing)
          return tx.contact.update({
            where: { id: existing.id },
            data: {
              contactName: existing.contactName || input.contactName,
              businessName: existing.businessName || input.businessName,
              contactNumber: existing.contactNumber || input.contactNumber,
              source: existing.source ?? input.source,
              sourceId: existing.sourceId ?? input.sourceId,
            },
          });
        return tx.contact.create({ data: { ...input, normalizedEmail } });
      });
      if (contact.suppressedAt) return reply.code(204).send();
      return reply.send({ id: contact.id });
    },
  );
  registerQrContactImport(app);
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const passwordHash = await hashPassword(input.password);
      try {
        const user = await db.user.create({
          data: { name: input.name, email: input.email, passwordHash },
        });
        const token = await reply.jwtSign({ sub: user.id, ver: user.authVersion });
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
      if (!user || !(await verifyPassword(user.passwordHash, input.password)))
        return reply.code(401).send({ error: 'Invalid email or password' });
      const token = await reply.jwtSign({ sub: user.id, ver: user.authVersion });
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
  app.post(
    '/api/auth/forgot-password',
    { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } },
    async (request) => {
      const input = forgotPasswordSchema.parse(request.body);
      const response: { message: string; developmentResetUrl?: string } = {
        message: 'If an account exists for that email, a password reset link has been sent.',
      };
      const user = await db.user.findUnique({ where: { email: input.email } });
      if (!user) return response;
      const { token, tokenHash } = createPasswordResetToken();
      const expiresAt = passwordResetExpiry(config.PASSWORD_RESET_EXPIRES_MINUTES);
      await db.$transaction([
        db.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
      ]);
      const resetUrl = `${config.APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        const delivery = await email.sendPasswordReset({
          to: user.email,
          name: user.name,
          resetUrl,
          expiresMinutes: config.PASSWORD_RESET_EXPIRES_MINUTES,
        });
        if (!delivery.delivered && config.NODE_ENV === 'development') {
          request.log.info({ resetUrl, userId: user.id }, 'Development password reset link');
          response.developmentResetUrl = resetUrl;
        }
      } catch (error) {
        request.log.error({ err: error, userId: user.id }, 'Password reset email failed');
      }
      return response;
    },
  );
  app.post(
    '/api/auth/reset-password',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const input = resetPasswordSchema.parse(request.body);
      const record = await db.passwordResetToken.findUnique({
        where: { tokenHash: hashPasswordResetToken(input.token) },
      });
      if (!record || record.usedAt || record.expiresAt <= new Date()) {
        return reply
          .code(400)
          .send({ error: 'This password reset link is invalid or has expired' });
      }
      const passwordHash = await hashPassword(input.newPassword);
      try {
        await db.$transaction(async (tx) => {
          const claimed = await tx.passwordResetToken.updateMany({
            where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
            data: { usedAt: new Date() },
          });
          if (claimed.count !== 1) throw new Error('RESET_TOKEN_ALREADY_USED');
          await tx.user.update({
            where: { id: record.userId },
            data: { passwordHash, authVersion: { increment: 1 } },
          });
          await tx.passwordResetToken.updateMany({
            where: { userId: record.userId, usedAt: null },
            data: { usedAt: new Date() },
          });
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'RESET_TOKEN_ALREADY_USED') {
          return reply
            .code(400)
            .send({ error: 'This password reset link is invalid or has expired' });
        }
        throw error;
      }
      reply.clearCookie('click_session', { path: '/' });
      return { message: 'Password updated. You can now sign in with your new password.' };
    },
  );
  app.get('/api/auth/me', { preHandler: requireAuth }, async (request: any) =>
    db.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, name: true, email: true },
    }),
  );

  app.patch(
    '/api/account/profile',
    { preHandler: requireAuth, config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (request: any, reply) => {
      const input = accountProfileSchema.parse(request.body);
      const user = await db.user.findUnique({ where: { id: request.user.sub } });
      if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
        return reply.code(401).send({ error: 'Your current password is incorrect' });
      }
      try {
        const updated = await db.user.update({
          where: { id: user.id },
          data: { name: input.name, email: input.email },
          select: { id: true, name: true, email: true },
        });
        return { user: updated };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply
            .code(409)
            .send({ error: 'An account already exists for this email address' });
        }
        throw error;
      }
    },
  );

  app.patch(
    '/api/account/password',
    { preHandler: requireAuth, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request: any, reply) => {
      const input = accountPasswordSchema.parse(request.body);
      const user = await db.user.findUnique({ where: { id: request.user.sub } });
      if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
        return reply.code(401).send({ error: 'Your current password is incorrect' });
      }
      const passwordHash = await hashPassword(input.newPassword);
      const updated = await db.user.update({
        where: { id: user.id },
        data: { passwordHash, authVersion: { increment: 1 } },
        select: { authVersion: true },
      });
      const token = await reply.jwtSign({ sub: user.id, ver: updated.authVersion });
      reply.setCookie('click_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        path: '/',
        maxAge: 28800,
      });
      return { message: 'Password updated successfully' };
    },
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
  app.get(
    '/api/businesses/:id/members',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const businessId = String(request.params.id);
      if (!(await owns(request.user.sub, businessId)))
        return reply.code(403).send({ error: 'Forbidden' });
      return db.businessMember.findMany({
        where: { businessId },
        include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
        orderBy: { user: { name: 'asc' } },
      });
    },
  );
  app.post(
    '/api/businesses/:id/members',
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request: any, reply) => {
      const businessId = String(request.params.id);
      const actor = await membershipFor(request.user.sub, businessId);
      if (!actor || actor.role !== 'OWNER') {
        return reply.code(403).send({ error: 'Only a business owner can add users' });
      }
      const input = createWorkspaceUserSchema.parse(request.body);
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { name: true },
      });
      if (!business) return reply.code(404).send({ error: 'Business not found' });
      const existing = await db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        const alreadyMember = await membershipFor(existing.id, businessId);
        if (alreadyMember)
          return reply.code(409).send({ error: 'That user already belongs to this business' });
        await db.businessMember.create({
          data: { businessId, userId: existing.id, role: input.role },
        });
        try {
          await email.sendWorkspaceInvitation({
            to: existing.email,
            name: existing.name,
            businessName: business.name,
            loginUrl: config.APP_URL,
          });
        } catch (error) {
          request.log.error(
            { err: error, userId: existing.id },
            'Workspace invitation email failed',
          );
        }
        await logActivity('USER_ADDED', {
          businessId,
          userId: request.user.sub,
          entityType: 'User',
          entityId: existing.id,
          metadata: { role: input.role },
        });
        return reply.code(201).send({
          user: { id: existing.id, name: existing.name, email: existing.email },
          role: input.role,
          existingAccount: true,
        });
      }

      const temporarySecret = createPasswordResetToken().token;
      const passwordHash = await hashPassword(temporarySecret);
      const reset = createPasswordResetToken();
      const expiresAt = passwordResetExpiry(config.PASSWORD_RESET_EXPIRES_MINUTES);
      const user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { name: input.name, email: input.email, passwordHash },
        });
        await tx.businessMember.create({
          data: { businessId, userId: created.id, role: input.role },
        });
        await tx.passwordResetToken.create({
          data: { userId: created.id, tokenHash: reset.tokenHash, expiresAt },
        });
        return created;
      });
      const setupUrl = `${config.APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(reset.token)}`;
      try {
        const delivery = await email.sendPasswordReset({
          to: user.email,
          name: user.name,
          resetUrl: setupUrl,
          expiresMinutes: config.PASSWORD_RESET_EXPIRES_MINUTES,
        });
        if (!delivery.delivered && config.NODE_ENV === 'development') {
          request.log.info({ setupUrl, userId: user.id }, 'Development new-user setup link');
        }
      } catch (error) {
        request.log.error({ err: error, userId: user.id }, 'New-user setup email failed');
      }
      await logActivity('USER_CREATED', {
        businessId,
        userId: request.user.sub,
        entityType: 'User',
        entityId: user.id,
        metadata: { role: input.role },
      });
      return reply.code(201).send({
        user: { id: user.id, name: user.name, email: user.email },
        role: input.role,
        existingAccount: false,
        developmentSetupUrl:
          config.NODE_ENV === 'development' && !email.configured ? setupUrl : undefined,
      });
    },
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
    if (!(await canManage(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    return serialiseBusiness(
      await db.business.update({
        where: { id: request.params.id },
        data: businessSchema.parse(request.body),
      }),
    );
  });
  app.delete('/api/businesses/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!(await isOwner(request.user.sub, request.params.id)))
      return reply.code(404).send({ error: 'Business not found' });
    await db.business.update({
      where: { id: request.params.id },
      data: { archivedAt: new Date() },
    });
    return reply.code(204).send();
  });

  const contactSchema = z.object({
    email: z.string().trim().email().max(255),
    businessName: z.string().trim().min(1).max(150),
    contactName: z.string().trim().min(1).max(150),
    contactNumber: z.string().trim().max(50),
    website: z.union([z.literal(''), z.string().trim().url().max(2048).refine(value => /^https?:\/\//i.test(value))]).optional(),
  });
  app.get(
    '/api/businesses/:id/contacts',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await owns(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const search = z
        .object({ search: z.string().trim().max(150).optional() })
        .parse(request.query).search;
      return db.contact.findMany({
        where: {
          businessId: request.params.id,
          suppressedAt: null,
          ...(search
            ? {
                OR: [
                  { businessName: { contains: search } },
                  { contactName: { contains: search } },
                  { email: { contains: search } },
                  { contactNumber: { contains: search } },
                ],
              }
            : {}),
        },
        orderBy: [{ businessName: 'asc' }, { contactName: 'asc' }],
      });
    },
  );
  app.post(
    '/api/businesses/:id/contacts',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canEdit(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const input = contactSchema.parse(request.body);
      const contact = await db.contact.create({
        data: {
          businessId: request.params.id,
          ...input,
          website: input.website ?? null,
          normalizedEmail: input.email.toLowerCase(),
        },
      });
      return reply.code(201).send(contact);
    },
  );
  app.put(
    '/api/businesses/:id/contacts/:contactId',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canEdit(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const existing = await db.contact.findFirst({
        where: { id: request.params.contactId, businessId: request.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'Contact not found' });
      const input = contactSchema.parse(request.body);
      return db.contact.update({
        where: { id: existing.id },
        data: { ...input, website: input.website ?? existing.website, normalizedEmail: input.email.toLowerCase() },
      });
    },
  );
  app.delete(
    '/api/businesses/:id/contacts/:contactId',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canEdit(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const existing = await db.contact.findFirst({
        where: { id: request.params.contactId, businessId: request.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'Contact not found' });
      await db.contact.update({ where: { id: existing.id }, data: { suppressedAt: new Date() } });
      return reply.code(204).send();
    },
  );

  app.post(
    '/api/businesses/:id/crawls',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canEdit(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const input = crawlRequestSchema.parse(request.body ?? {});
      return new CrawlerService(config.CRAWLER_TIMEOUT_MS, config.CONNECTOR_ENCRYPTION_KEY).crawl(
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
    if (!(await canEdit(request.user.sub, issue.businessId)))
      return reply.code(403).send({ error: 'Editor access is required' });

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
    return reply.code(201).send({
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
    if (!(await canEdit(request.user.sub, issue.businessId)))
      return reply.code(403).send({ error: 'Editor access is required' });
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
  app.get(
    '/api/businesses/:id/visual-audits',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await owns(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const website = await db.website.findUniqueOrThrow({
        where: { businessId: request.params.id },
      });
      return db.visualAudit.findMany({
        where: { websiteId: website.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    },
  );
  app.post(
    '/api/businesses/:id/visual-audits',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 3, timeWindow: '5 minutes' } },
    },
    async (request: any, reply) => {
      if (!(await canEdit(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      if (!ai) return reply.code(503).send({ error: 'AI generation is not configured' });
      const website = await db.website.findUniqueOrThrow({
        where: { businessId: request.params.id },
      });
      const running = await db.visualAudit.findFirst({
        where: { websiteId: website.id, status: { in: ['QUEUED', 'RUNNING'] } },
      });
      if (running)
        return reply
          .code(409)
          .send({ error: 'A visual audit is already running for this website' });
      const latestCrawl = await db.websiteCrawl.findFirst({
        where: { websiteId: website.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: { pages: { where: { statusCode: { gte: 200, lt: 300 } }, select: { url: true } } },
      });
      if (!latestCrawl?.pages.length)
        return reply
          .code(409)
          .send({ error: 'Run a website audit first so visual pages can be selected' });
      const urls = selectVisualAuditUrls(
        latestCrawl.pages.map((page) => page.url),
        config.VISUAL_AUDIT_MAX_PAGES,
      );
      const audit = await db.visualAudit.create({
        data: { websiteId: website.id, status: 'RUNNING', startedAt: new Date() },
      });
      try {
        const captures = await captureWebsiteLayouts(urls, config.BROWSER_EXECUTABLE_PATH);
        const result = await ai.visualConsistency(request.params.id, captures);
        const completed = await db.visualAudit.update({
          where: { id: audit.id },
          data: {
            status: 'COMPLETED',
            pagesAudited: urls.length,
            result: result as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        await logActivity('website.visual_audit_completed', {
          businessId: request.params.id,
          userId: request.user.sub,
          entityType: 'VisualAudit',
          entityId: audit.id,
          metadata: { pages: urls.length, findings: result.findings.length },
        });
        return reply.code(201).send(completed);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Visual audit failed';
        await db.visualAudit.update({
          where: { id: audit.id },
          data: { status: 'FAILED', error: message, completedAt: new Date() },
        });
        const publicError = publicAiError(error);
        if (publicError)
          return reply
            .code(publicError.statusCode)
            .send({ error: publicError.message, actionUrl: publicError.actionUrl });
        app.log.error(error);
        return reply.code(500).send({ error: `Visual audit failed: ${message}` });
      }
    },
  );
  app.get(
    '/api/businesses/:id/automation',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await owns(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const website = await db.website.findUniqueOrThrow({
        where: { businessId: request.params.id },
      });
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
        connection: connectionView(website),
        changes,
      };
    },
  );
  app.put(
    '/api/businesses/:id/automation',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canManage(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const input = z
        .object({
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
        })
        .parse(request.body);
      const website = await db.website.findUniqueOrThrow({
        where: { businessId: request.params.id },
      });
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
          ...(input.provider
            ? {
                connectionProvider: input.provider,
                ...(input.provider !== website.connectionProvider
                  ? {
                      connectionStatus: 'DISCONNECTED' as const,
                      connectionUsername: null,
                      connectionSecret: null,
                      connectionVerifiedAt: null,
                      connectionError: null,
                    }
                  : {}),
              }
            : {}),
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
        connection: connectionView(updated),
        changes: await db.websiteChange.findMany({
          where: { websiteId: updated.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      };
    },
  );
  app.post(
    '/api/businesses/:id/connectors/wordpress/connect',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request: any, reply) => {
      if (!(await canManage(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      if (!config.CONNECTOR_ENCRYPTION_KEY)
        return reply.code(503).send({
          error:
            'Connector encryption is not configured. Add CONNECTOR_ENCRYPTION_KEY and restart the API.',
        });
      const input = z
        .object({
          username: z.string().trim().min(1).max(255),
          applicationPassword: z.string().trim().min(8).max(500),
          target: z.literal('STAGING'),
          baseUrl: z.string().url(),
        })
        .parse(request.body);
      const website = await db.website.findUniqueOrThrow({
        where: { businessId: request.params.id },
      });
      let target: { url: string; isLocal: boolean };
      try {
        target = validateStagingTarget(website.baseUrl, input.baseUrl, config.NODE_ENV);
      } catch (error) {
        return reply
          .code(400)
          .send({ error: error instanceof Error ? error.message : 'Invalid staging URL' });
      }
      try {
        await verifyWordPressConnection({
          baseUrl: target.url,
          username: input.username,
          applicationPassword: input.applicationPassword,
          allowLocalDevelopment: target.isLocal && config.NODE_ENV !== 'production',
        });
        const updated = await db.website.update({
          where: { id: website.id },
          data: {
            connectionProvider: 'WORDPRESS',
            connectionStatus: 'CONNECTED',
            connectionUsername: input.username,
            connectionSecret: encryptConnectorSecret(
              input.applicationPassword,
              config.CONNECTOR_ENCRYPTION_KEY,
            ),
            connectionVerifiedAt: new Date(),
            connectionError: null,
            stagingBaseUrl: target.url,
            connectionBaseUrl: target.url,
            connectionTarget: 'STAGING',
          },
        });
        await logActivity('website.connector_connected', {
          businessId: request.params.id,
          userId: request.user.sub,
          entityType: 'Website',
          entityId: website.id,
          metadata: { provider: 'WORDPRESS' },
        });
        return connectionView(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'WordPress connection failed';
        await db.website.update({
          where: { id: website.id },
          data: {
            connectionProvider: 'WORDPRESS',
            connectionStatus: 'ERROR',
            connectionError: message,
          },
        });
        return reply.code(400).send({ error: message });
      }
    },
  );
  app.post(
    '/api/businesses/:id/connectors/wordpress/test',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canManage(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      if (!config.CONNECTOR_ENCRYPTION_KEY)
        return reply.code(503).send({ error: 'Connector encryption is not configured' });
      const website = await db.website.findUniqueOrThrow({
        where: { businessId: request.params.id },
      });
      if (
        website.connectionProvider !== 'WORDPRESS' ||
        !website.connectionUsername ||
        !website.connectionSecret
      )
        return reply.code(409).send({ error: 'No saved WordPress connection was found' });
      try {
        const applicationPassword = decryptConnectorSecret(
          website.connectionSecret,
          config.CONNECTOR_ENCRYPTION_KEY,
        );
        const baseUrl = website.connectionBaseUrl ?? website.baseUrl;
        const isLocal = ['localhost', '127.0.0.1', '::1'].includes(
          new URL(baseUrl).hostname.toLowerCase(),
        );
        await verifyWordPressConnection({
          baseUrl,
          username: website.connectionUsername,
          applicationPassword,
          allowLocalDevelopment:
            website.connectionTarget === 'STAGING' && isLocal && config.NODE_ENV !== 'production',
        });
        const updated = await db.website.update({
          where: { id: website.id },
          data: {
            connectionStatus: 'CONNECTED',
            connectionVerifiedAt: new Date(),
            connectionError: null,
          },
        });
        return connectionView(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'WordPress connection test failed';
        await db.website.update({
          where: { id: website.id },
          data: { connectionStatus: 'ERROR', connectionError: message },
        });
        return reply.code(400).send({ error: message });
      }
    },
  );
  app.delete(
    '/api/businesses/:id/connector',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canManage(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const website = await db.website.findUniqueOrThrow({
        where: { businessId: request.params.id },
      });
      await db.website.update({
        where: { id: website.id },
        data: {
          connectionProvider: 'NONE',
          connectionStatus: 'DISCONNECTED',
          connectionUsername: null,
          connectionSecret: null,
          connectionVerifiedAt: null,
          connectionError: null,
          connectionBaseUrl: null,
          automationMode:
            website.automationMode === 'AUTO_LOW_RISK'
              ? 'APPROVAL_REQUIRED'
              : website.automationMode,
        },
      });
      await logActivity('website.connector_disconnected', {
        businessId: request.params.id,
        userId: request.user.sub,
        entityType: 'Website',
        entityId: website.id,
      });
      return reply.code(204).send();
    },
  );
  const executeAutoFixForIssue = async (issueId: string, userId: string) => {
    const issue = await db.seoIssue.findFirst({
      where: { id: issueId },
      include: { page: true, business: { include: { website: true } } },
    });
    if (!issue || !issue.page || !issue.business.website) {
      throw new Error('SEO issue or affected website page not found');
    }

    const website = issue.business.website;
    if (website.connectionTarget !== 'STAGING' || !website.stagingBaseUrl) {
      throw new Error(
        'Automated execution is restricted to a verified staging website. Live-site writes are disabled.',
      );
    }
    const publisher = await getPublisher(website.id, config.CONNECTOR_ENCRYPTION_KEY);
    if (!publisher) {
      throw new Error(
        'WordPress site is not connected or verified. Please configure WordPress in Automation Settings.',
      );
    }

    let recommendation = await db.recommendation.findFirst({
      where: { businessId: issue.businessId, source: `SEO_ISSUE:${issue.id}` },
      orderBy: { createdAt: 'desc' },
    });

    let targetField = 'SEO_TITLE';
    const findingTitle = issue.title.toLowerCase();
    if (findingTitle.includes('meta description')) targetField = 'META_DESCRIPTION';
    else if (findingTitle.includes('h1') || findingTitle.includes('heading')) targetField = 'H1';
    else if (findingTitle.includes('copy') || findingTitle.includes('content'))
      targetField = 'CONTENT';

    if (!recommendation || !recommendation.proposedValue) {
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
        } catch {
          // fallback to rule-based
        }
      }
      targetField = generated.targetField;
      recommendation = await db.recommendation.create({
        data: {
          businessId: issue.businessId,
          pageId: issue.pageId,
          source: `SEO_ISSUE:${issue.id}`,
          category: issue.category,
          severity: issue.severity,
          title: `${generated.targetField} suggestion`,
          description: generated.rationale,
          currentValue: issue.page.title ?? null,
          proposedValue: generated.proposedValue,
          status: 'OPEN',
        },
      });
    }

    // Normalise the free-text targetField the AI/rule-based generator returns down to a
    // strict set the connector can apply safely. Anything unmappable (image alt text,
    // H2 structure, internal links, etc.) is rejected instead of being forced into a field.
    const normaliseField = (raw: string): 'SEO_TITLE' | 'META_DESCRIPTION' | 'H1' | 'CONTENT' => {
      const f = raw.toLowerCase();
      if (f.includes('alt')) throw new Error('Image alt text cannot be auto-applied safely');
      if (f.includes('h1')) return 'H1';
      if (f.includes('h2') || f.includes('heading') || f.includes('section'))
        throw new Error('Heading structure changes cannot be auto-applied safely');
      if (f.includes('meta') || f.includes('description')) return 'META_DESCRIPTION';
      if (f.includes('title')) return 'SEO_TITLE';
      if (f.includes('content') || f.includes('copy') || f.includes('body')) return 'CONTENT';
      throw new Error(`Auto-fix does not support the "${raw}" field`);
    };
    const field = normaliseField(targetField);

    // Capture the real current value from WordPress so the change log and any rollback
    // are accurate, rather than trusting the crawl-time snapshot.
    const currentValue =
      (await publisher.readField(issue.page.url, field)) ?? recommendation.currentValue;

    const applyResult = await publisher.apply({
      targetUrl: issue.page.url,
      field,
      expectedCurrentValue: currentValue,
      proposedValue: recommendation.proposedValue!,
    });

    // Verify the change actually took effect by reading the field back. For H1 the value
    // is prepended into the content body, so check containment rather than equality.
    const readBack = await publisher.readField(issue.page.url, field);
    const normalise = (v: string | null) =>
      (v ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const expected = normalise(recommendation.proposedValue);
    const actual = normalise(readBack);
    const verified = field === 'H1' ? actual.includes(expected) : actual === expected;
    if (!verified) {
      await db.websiteChange.create({
        data: {
          websiteId: website.id,
          seoIssueId: issue.id,
          recommendationId: recommendation.id,
          targetUrl: issue.page.url,
          targetField: field,
          beforeValue: currentValue,
          proposedValue: recommendation.proposedValue!,
          appliedValue: applyResult.appliedValue,
          status: 'FAILED',
          failureReason: 'Applied value could not be verified on the staging page',
          targetEnvironment: 'STAGING',
          executionTargetUrl: stagingExecutionUrl(issue.page.url, website.stagingBaseUrl),
          approvedById: userId,
          approvedAt: new Date(),
          appliedAt: new Date(),
        },
      });
      throw new Error(
        'The fix was sent to staging WordPress but could not be verified on the staging page',
      );
    }

    const change = await db.websiteChange.create({
      data: {
        websiteId: website.id,
        seoIssueId: issue.id,
        recommendationId: recommendation.id,
        targetUrl: issue.page.url,
        targetField: field,
        beforeValue: currentValue,
        proposedValue: recommendation.proposedValue!,
        appliedValue: applyResult.appliedValue,
        status: 'APPLIED',
        approvedById: userId,
        approvedAt: new Date(),
        appliedAt: new Date(),
        verifiedAt: new Date(),
        targetEnvironment: 'STAGING',
        executionTargetUrl: stagingExecutionUrl(issue.page.url, website.stagingBaseUrl),
      },
    });

    const updatedIssue = await db.seoIssue.update({
      where: { id: issue.id },
      data: { status: 'COMPLETED' },
      include: { page: true },
    });

    await db.recommendation.update({
      where: { id: recommendation.id },
      data: { status: 'APPROVED' },
    });

    await logActivity('seo.auto_fixed', {
      businessId: issue.businessId,
      userId,
      entityType: 'SeoIssue',
      entityId: issue.id,
      metadata: { targetUrl: issue.page.url, targetField, changeId: change.id },
    });

    return { issue: updatedIssue, change, appliedValue: applyResult.appliedValue };
  };

  app.post('/api/seo/:id/auto-fix', { preHandler: requireAuth }, async (request: any, reply) => {
    const issue = await db.seoIssue.findFirst({
      where: {
        id: request.params.id,
        business: { members: { some: { userId: request.user.sub } } },
      },
    });
    if (!issue) return reply.code(404).send({ error: 'SEO issue not found' });
    if (!(await canEdit(request.user.sub, issue.businessId)))
      return reply.code(403).send({ error: 'Editor access is required' });
    try {
      const result = await executeAutoFixForIssue(issue.id, request.user.sub);
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auto-fix failed';
      return reply.code(400).send({ error: message });
    }
  });

  app.post(
    '/api/businesses/:id/seo/auto-fix-all',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canEdit(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const website = await db.website.findUnique({ where: { businessId: request.params.id } });
      if (!website || website.connectionStatus !== 'CONNECTED')
        return reply.code(400).send({
          error: 'WordPress site is not connected. Connect your site in Automation Settings first.',
        });
      if (website.connectionTarget !== 'STAGING')
        return reply.code(400).send({
          error:
            'Bulk auto-fix is restricted to a verified staging website. Live-site writes are disabled.',
        });

      const latestCrawl = await db.websiteCrawl.findFirst({
        where: { websiteId: website.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      });

      const issues = await db.seoIssue.findMany({
        where: {
          businessId: request.params.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          ...(latestCrawl ? { page: { crawlId: latestCrawl.id } } : {}),
        },
        include: { page: { select: { url: true } } },
      });

      // The WordPress connector resolves a URL to a post by path slug only, ignoring the
      // query string — so every `book-today?event_id=N` variant maps to the SAME page.
      // Applying a fix per query-variant would overwrite that one page repeatedly
      // (last-write-wins) and corrupt it. Apply at most one fix per canonical resource.
      const resourceKey = (url: string) => {
        try {
          const u = new URL(url);
          return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
        } catch {
          return url;
        }
      };
      const seenResources = new Set<string>();
      const deduped: typeof issues = [];
      for (const issue of issues) {
        const key = issue.page ? resourceKey(issue.page.url) : issue.id;
        if (seenResources.has(key)) continue;
        seenResources.add(key);
        deduped.push(issue);
      }

      const results = { total: deduped.length, fixed: 0, failed: 0, errors: [] as string[] };
      for (const issue of deduped) {
        try {
          await executeAutoFixForIssue(issue.id, request.user.sub);
          results.fixed++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`${issue.title} (${issue.id}): ${err?.message || 'Failed'}`);
        }
      }
      return reply.send(results);
    },
  );

  app.post(
    '/api/seo/:id/prepare-change',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const input = z
        .object({
          recommendationId: z.string().uuid(),
          targetField: z.string().min(2).max(100),
          proposedValue: z.string().min(1),
        })
        .parse(request.body);
      const issue = await db.seoIssue.findFirst({
        where: {
          id: request.params.id,
          business: { members: { some: { userId: request.user.sub } } },
        },
        include: { page: true, business: { include: { website: true } } },
      });
      if (!issue?.page || !issue.business.website)
        return reply.code(404).send({ error: 'SEO issue or website not found' });
      if (!(await canEdit(request.user.sub, issue.businessId)))
        return reply.code(403).send({ error: 'Editor access is required' });
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
          targetEnvironment:
            issue.business.website.connectionTarget === 'STAGING' ? 'STAGING' : 'LIVE',
          executionTargetUrl:
            issue.business.website.connectionTarget === 'STAGING' &&
            issue.business.website.stagingBaseUrl
              ? stagingExecutionUrl(issue.page.url, issue.business.website.stagingBaseUrl)
              : issue.page.url,
        },
      });
      await logActivity('website.change_prepared', {
        businessId: issue.businessId,
        userId: request.user.sub,
        entityType: 'WebsiteChange',
        entityId: change.id,
      });
      return reply.code(201).send(change);
    },
  );
  app.post(
    '/api/website-changes/:id/apply',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const change = await db.websiteChange.findFirst({
        where: {
          id: request.params.id,
          website: { business: { members: { some: { userId: request.user.sub } } } },
        },
        include: { website: { include: { business: true } } },
      });
      if (!change) return reply.code(404).send({ error: 'Prepared change not found' });
      if (!(await canEdit(request.user.sub, change.website.businessId)))
        return reply.code(403).send({ error: 'Editor access is required' });
      if (change.website.connectionStatus !== 'CONNECTED')
        return reply.code(409).send({ error: 'The website is not connected for publishing' });
      if (change.website.connectionTarget !== 'STAGING' || change.targetEnvironment !== 'STAGING')
        return reply.code(409).send({
          error:
            'Prepared change execution is restricted to the verified staging website. Live-site writes are disabled.',
        });
      const publisher = await getPublisher(change.websiteId, config.CONNECTOR_ENCRYPTION_KEY);
      if (!publisher)
        return reply
          .code(409)
          .send({ error: 'No verified publishing connector is available for this website yet' });
      try {
        const result = await publisher.apply({
          targetUrl: change.targetUrl,
          field: change.targetField as any,
          expectedCurrentValue: change.beforeValue,
          proposedValue: change.proposedValue,
        });
        const updated = await db.websiteChange.update({
          where: { id: change.id },
          data: {
            status: 'APPLIED',
            appliedValue: result.appliedValue,
            appliedAt: new Date(),
            approvedAt: change.approvedAt ?? new Date(),
            approvedById: request.user.sub,
          },
        });
        if (change.seoIssueId) {
          await db.seoIssue.update({
            where: { id: change.seoIssueId },
            data: { status: 'COMPLETED' },
          });
        }
        return reply.send(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply change';
        await db.websiteChange.update({
          where: { id: change.id },
          data: { status: 'FAILED', failureReason: message },
        });
        return reply.code(400).send({ error: message });
      }
    },
  );
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

  const nextDiscoveryRun = (frequency: string, from = new Date()) => {
    if (frequency === 'DAILY') return new Date(from.getTime() + 24 * 60 * 60 * 1000);
    if (frequency === 'WEEKLY') return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    return null;
  };

  const runLeadDiscovery = async (businessId: string, capturedById: string) => {
    if (!ai) throw Object.assign(new Error('AI generation is not configured'), { statusCode: 503 });
    const profile = await db.leadDiscoveryProfile.findUnique({ where: { businessId } });
    if (!profile || !profile.enabled)
      throw Object.assign(new Error('Configure and enable lead discovery first'), { statusCode: 400 });
    const activeRun = await db.leadDiscoveryRun.findFirst({
      where: {
        businessId,
        status: 'RUNNING',
        startedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });
    if (activeRun)
      throw Object.assign(new Error('A lead discovery scan is already running'), { statusCode: 409 });
    const run = await db.leadDiscoveryRun.create({ data: { businessId } });
    try {
      const result = await ai.leadDiscovery(businessId, {
        platforms: profile.platforms as string[],
        searchTerms: profile.searchTerms as string[],
        intentPhrases: profile.intentPhrases as string[],
        excludedTerms: profile.excludedTerms as string[],
        locations: profile.locations as string[],
        maxResults: profile.maxResults,
      });
      let createdCount = 0;
      for (const opportunity of result.opportunities) {
        const identity = leadSourceIdentity(opportunity.platform, opportunity.url);
        const existing = await db.leadOpportunity.findUnique({
          where: { businessId_sourceKeyHash: { businessId, sourceKeyHash: identity.sourceKeyHash } },
        });
        if (existing) continue;
        await db.leadOpportunity.create({
          data: {
            businessId,
            platform: opportunity.platform,
            originalUrl: opportunity.url,
            ...identity,
            postText: opportunity.sourceExcerpt,
            sourceTextHash: sha256(opportunity.sourceExcerpt),
            communityName: opportunity.communityName,
            authorDisplayName: opportunity.authorDisplayName,
            postedAt: opportunity.postedAt ? new Date(opportunity.postedAt) : null,
            capturedById,
            captureMethod: 'AI_DISCOVERY',
            relevance: opportunity.relevanceScore >= 70 ? 'RELEVANT' : 'UNCERTAIN',
            relevanceReason: opportunity.relevanceReason,
            relevanceScore: opportunity.relevanceScore,
          },
        });
        createdCount += 1;
      }
      const completedAt = new Date();
      await db.$transaction([
        db.leadDiscoveryRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            discoveredCount: result.opportunities.length,
            createdCount,
            completedAt,
          },
        }),
        db.leadDiscoveryProfile.update({
          where: { businessId },
          data: { lastRunAt: completedAt, nextRunAt: nextDiscoveryRun(profile.frequency, completedAt) },
        }),
      ]);
      await logActivity('lead.discovery_completed', {
        businessId,
        userId: capturedById,
        entityType: 'LeadDiscoveryRun',
        entityId: run.id,
        metadata: { discovered: result.opportunities.length, created: createdCount },
      });
      return { runId: run.id, discoveredCount: result.opportunities.length, createdCount };
    } catch (error) {
      await db.leadDiscoveryRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message.slice(0, 2000) : 'Unknown error',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  };

  app.get(
    '/api/businesses/:id/lead-discovery',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await owns(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      const business = await db.business.findUniqueOrThrow({ where: { id: request.params.id } });
      const profile = await db.leadDiscoveryProfile.findUnique({ where: { businessId: business.id } });
      const runs = await db.leadDiscoveryRun.findMany({
        where: { businessId: business.id },
        orderBy: { startedAt: 'desc' },
        take: 5,
      });
      return {
        profile: profile ?? {
          enabled: true,
          platforms: ['REDDIT', 'FACEBOOK', 'LINKEDIN', 'FORUM'],
          searchTerms: [business.industry || business.name],
          intentPhrases: ['recommendations', 'looking for', 'need help', 'best option'],
          excludedTerms: ['job vacancy', 'for sale'],
          locations: business.location ? [business.location] : [],
          frequency: 'MANUAL',
          maxResults: 10,
          lastRunAt: null,
          nextRunAt: null,
        },
        configured: Boolean(profile),
        runs,
      };
    },
  );

  app.put(
    '/api/businesses/:id/lead-discovery',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canManage(request.user.sub, request.params.id)))
        return reply.code(403).send({ error: 'Owner or manager access is required' });
      const input = leadDiscoveryProfileSchema.parse(request.body);
      const now = new Date();
      const profile = await db.leadDiscoveryProfile.upsert({
        where: { businessId: request.params.id },
        create: {
          businessId: request.params.id,
          updatedById: request.user.sub,
          ...input,
          nextRunAt: input.enabled ? nextDiscoveryRun(input.frequency, now) : null,
        },
        update: {
          updatedById: request.user.sub,
          ...input,
          nextRunAt: input.enabled ? nextDiscoveryRun(input.frequency, now) : null,
        },
      });
      await logActivity('lead.discovery_profile_saved', {
        businessId: request.params.id,
        userId: request.user.sub,
        entityType: 'LeadDiscoveryProfile',
        entityId: profile.id,
      });
      return profile;
    },
  );

  app.post(
    '/api/businesses/:id/lead-discovery/run',
    { preHandler: requireAuth, config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (request: any, reply) => {
      if (!(await canEdit(request.user.sub, request.params.id)))
        return reply.code(403).send({ error: 'Editor access is required' });
      return reply.send(await runLeadDiscovery(request.params.id, request.user.sub));
    },
  );

  app.post('/api/internal/lead-discovery/run-due', async (request: any, reply) => {
    if (!config.LEAD_DISCOVERY_CRON_SECRET) return reply.code(404).send({ error: 'Not found' });
    const supplied = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!supplied || sha256(supplied) !== sha256(config.LEAD_DISCOVERY_CRON_SECRET))
      return reply.code(401).send({ error: 'Authentication required' });
    const profiles = await db.leadDiscoveryProfile.findMany({
      where: { enabled: true, frequency: { in: ['DAILY', 'WEEKLY'] }, nextRunAt: { lte: new Date() } },
      orderBy: { nextRunAt: 'asc' },
      take: 3,
    });
    const results = [];
    for (const profile of profiles) {
      try {
        results.push({ businessId: profile.businessId, ...(await runLeadDiscovery(profile.businessId, profile.updatedById)) });
      } catch (error) {
        results.push({ businessId: profile.businessId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return { processed: profiles.length, results };
  });

  const leadDetail = (id: string) =>
    db.leadOpportunity.findUnique({
      where: { id },
      include: {
        capturedBy: { select: { id: true, name: true } },
        reply: {
          include: {
            contentItem: true,
            recommendation: true,
            currentRevision: true,
            activeApproval: true,
            revisions: {
              orderBy: { revisionNumber: 'desc' },
              include: { createdBy: { select: { name: true } } },
            },
            approvals: {
              orderBy: { decidedAt: 'desc' },
              include: { actor: { select: { name: true } } },
            },
            publication: { include: { recordedBy: { select: { name: true } } } },
          },
        },
      },
    });

  const createRevision = async (input: {
    leadId: string;
    body: string;
    postingIdentity: string;
    userId: string;
    aiGenerated: boolean;
    generationMetadata?: Prisma.InputJsonValue;
  }) =>
    db.$transaction(async (tx) => {
      const lead = await tx.leadOpportunity.findUniqueOrThrow({
        where: { id: input.leadId },
        include: { reply: true },
      });
      if (lead.status === 'DISMISSED' || lead.status === 'CLOSED')
        throw Object.assign(new Error('This opportunity is no longer actionable'), {
          statusCode: 409,
        });
      let reply = lead.reply;
      if (!reply) {
        const contentItem = await tx.contentItem.create({
          data: {
            businessId: lead.businessId,
            title: `Reply to ${lead.platform} opportunity`,
            type: 'LEAD_REPLY',
            status: 'DRAFT',
            body: input.body,
            tags: [lead.platform],
            notes: 'Lead reply. Approval does not publish externally.',
            aiGenerated: input.aiGenerated,
          },
        });
        const recommendation = await tx.recommendation.create({
          data: {
            businessId: lead.businessId,
            source: `LEAD:${lead.id}`,
            category: 'OUTREACH',
            severity: 'OPPORTUNITY',
            title: `Respond to ${lead.platform} opportunity`,
            description: lead.relevanceReason ?? 'Review this opportunity and proposed reply.',
            proposedValue: input.body,
            status: 'OPEN',
          },
        });
        reply = await tx.leadReply.create({
          data: {
            businessId: lead.businessId,
            leadId: lead.id,
            contentItemId: contentItem.id,
            recommendationId: recommendation.id,
          },
        });
      } else if (reply.activeApprovalId) {
        await tx.leadReplyApproval.update({
          where: { id: reply.activeApprovalId },
          data: { revokedAt: new Date(), revocationReason: 'Reply text was revised' },
        });
        await logActivityStrict(tx, 'reply.approval_invalidated', {
          businessId: lead.businessId,
          userId: input.userId,
          entityType: 'LeadReply',
          entityId: reply.id,
        });
      }
      const previous = await tx.leadReplyRevision.aggregate({
        where: { replyId: reply.id },
        _max: { revisionNumber: true },
      });
      const revision = await tx.leadReplyRevision.create({
        data: {
          replyId: reply.id,
          revisionNumber: (previous._max.revisionNumber ?? 0) + 1,
          body: input.body,
          bodyHash: sha256(input.body),
          sourceVersion: lead.sourceVersion,
          sourceTextHash: lead.sourceTextHash,
          postingIdentity: input.postingIdentity,
          createdById: input.userId,
          aiGenerated: input.aiGenerated,
          ...(input.generationMetadata !== undefined
            ? { generationMetadata: input.generationMetadata }
            : {}),
        },
      });
      await tx.leadReply.update({
        where: { id: reply.id },
        data: { currentRevisionId: revision.id, activeApprovalId: null, version: { increment: 1 } },
      });
      await tx.contentItem.update({
        where: { id: reply.contentItemId },
        data: { body: input.body, status: 'DRAFT', aiGenerated: input.aiGenerated },
      });
      await tx.recommendation.update({
        where: { id: reply.recommendationId },
        data: { proposedValue: input.body, status: 'OPEN' },
      });
      await logActivityStrict(tx, input.aiGenerated ? 'reply.generated' : 'reply.revised', {
        businessId: lead.businessId,
        userId: input.userId,
        entityType: 'LeadReply',
        entityId: reply.id,
        metadata: { revisionId: revision.id, revisionNumber: revision.revisionNumber },
      });
      return revision;
    });

  app.post(
    '/api/businesses/:businessId/leads',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const businessId = request.params.businessId;
      if (!(await canEdit(request.user.sub, businessId)))
        return reply.code(403).send({ error: 'Editor access is required' });
      const input = captureLeadSchema.parse(request.body);
      const identity = leadSourceIdentity(input.platform, input.originalUrl);
      const existing = await db.leadOpportunity.findUnique({
        where: { businessId_sourceKeyHash: { businessId, sourceKeyHash: identity.sourceKeyHash } },
      });
      if (existing) {
        await logActivity('lead.duplicate_detected', {
          businessId,
          userId: request.user.sub,
          entityType: 'LeadOpportunity',
          entityId: existing.id,
        });
        return reply.send({ lead: existing, duplicate: true });
      }
      try {
        const lead = await db.$transaction(async (tx) => {
          const created = await tx.leadOpportunity.create({
            data: {
              businessId,
              platform: input.platform,
              originalUrl: input.originalUrl,
              ...identity,
              postText: input.postText,
              sourceTextHash: sha256(input.postText),
              communityName: input.communityName,
              authorDisplayName: input.authorDisplayName,
              postedAt: input.postedAt ? new Date(input.postedAt) : null,
              capturedById: request.user.sub,
            } as Prisma.LeadOpportunityUncheckedCreateInput,
          });
          await logActivityStrict(tx, 'lead.captured', {
            businessId,
            userId: request.user.sub,
            entityType: 'LeadOpportunity',
            entityId: created.id,
            metadata: { platform: input.platform },
          });
          return created;
        });
        return reply.code(201).send({ lead, duplicate: false });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const lead = await db.leadOpportunity.findUniqueOrThrow({
            where: {
              businessId_sourceKeyHash: { businessId, sourceKeyHash: identity.sourceKeyHash },
            },
          });
          return reply.send({ lead, duplicate: true });
        }
        throw error;
      }
    },
  );

  app.get(
    '/api/businesses/:businessId/leads',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const businessId = request.params.businessId;
      if (!(await owns(request.user.sub, businessId)))
        return reply.code(404).send({ error: 'Business not found' });
      const query = z
        .object({
          status: z.enum(['NEW', 'QUALIFIED', 'DISMISSED', 'CLOSED']).optional(),
          platform: z.string().max(50).optional(),
          search: z.string().max(200).optional(),
        })
        .parse(request.query);
      return db.leadOpportunity.findMany({
        where: {
          businessId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.platform ? { platform: query.platform } : {}),
          ...(query.search
            ? {
                OR: [
                  { postText: { contains: query.search } },
                  { communityName: { contains: query.search } },
                ],
              }
            : {}),
        },
        include: {
          reply: {
            include: {
              contentItem: true,
              currentRevision: true,
              activeApproval: true,
              publication: true,
            },
          },
        },
        orderBy: { capturedAt: 'desc' },
        take: 100,
      });
    },
  );

  app.get('/api/leads/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    const lead = await leadDetail(request.params.id);
    if (!lead || !(await owns(request.user.sub, lead.businessId)))
      return reply.code(404).send({ error: 'Opportunity not found' });
    return lead;
  });

  app.patch('/api/leads/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    const lead = await db.leadOpportunity.findUnique({ where: { id: request.params.id } });
    if (!lead || !(await canEdit(request.user.sub, lead.businessId)))
      return reply.code(404).send({ error: 'Opportunity not found' });
    const input = z
      .object({
        status: z.enum(['QUALIFIED', 'DISMISSED']),
        reason: z.string().trim().max(2000).optional(),
        expectedVersion: z.number().int().positive(),
      })
      .parse(request.body);
    if (lead.version !== input.expectedVersion)
      return reply.code(409).send({ error: 'This opportunity changed. Refresh and try again.' });
    if (input.status === 'DISMISSED' && !input.reason)
      return reply.code(400).send({ error: 'A dismissal reason is required' });
    await db.$transaction(async (tx) => {
      await tx.leadOpportunity.update({
        where: { id: lead.id },
        data: {
          status: input.status,
          dismissalReason: input.status === 'DISMISSED' ? (input.reason ?? null) : null,
          version: { increment: 1 },
        },
      });
      if (
        input.status === 'DISMISSED' &&
        (await tx.leadReply.findUnique({ where: { leadId: lead.id } }))
      ) {
        const linked = await tx.leadReply.findUniqueOrThrow({ where: { leadId: lead.id } });
        if (linked.activeApprovalId)
          await tx.leadReplyApproval.update({
            where: { id: linked.activeApprovalId },
            data: { revokedAt: new Date(), revocationReason: 'Opportunity dismissed' },
          });
        await tx.leadReply.update({ where: { id: linked.id }, data: { activeApprovalId: null } });
        await tx.contentItem.update({
          where: { id: linked.contentItemId },
          data: { status: 'REJECTED' },
        });
        await tx.recommendation.update({
          where: { id: linked.recommendationId },
          data: { status: 'DISMISSED' },
        });
      }
      await logActivityStrict(
        tx,
        input.status === 'DISMISSED' ? 'lead.dismissed' : 'lead.qualified',
        {
          businessId: lead.businessId,
          userId: request.user.sub,
          entityType: 'LeadOpportunity',
          entityId: lead.id,
          metadata: { reason: input.reason ?? null },
        },
      );
    });
    return leadDetail(lead.id);
  });

  app.post(
    '/api/leads/:id/reply/generate',
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request: any, reply) => {
      if (!ai)
        return reply.code(503).send({
          error: 'AI generation is not configured. You can still write a reply manually.',
        });
      const lead = await db.leadOpportunity.findUnique({ where: { id: request.params.id } });
      if (!lead || !(await canEdit(request.user.sub, lead.businessId)))
        return reply.code(404).send({ error: 'Opportunity not found' });
      const { postingIdentity } = z
        .object({ postingIdentity: z.string().trim().min(2).max(255) })
        .parse(request.body);
      const policy = await db.businessOutreachPolicy.findUnique({
        where: { businessId: lead.businessId },
      });
      const policyValue = policy ?? {
        version: 1,
        speakerName: postingIdentity,
        allowBusinessName: true,
        allowPublicLinks: false,
        allowedUrls: [],
        approvedClaims: [],
        ctaStyle: 'Helpful and low pressure',
        excludedTopics: [],
        maxReplyLength: 1200,
      };
      const result = await ai.leadReply(lead.businessId, lead, policyValue as any, postingIdentity);
      await db.leadOpportunity.update({
        where: { id: lead.id },
        data: {
          relevance: result.relevance,
          relevanceReason: result.rationale,
          status: result.relevance === 'RELEVANT' ? 'QUALIFIED' : lead.status,
          version: { increment: 1 },
        },
      });
      if (!result.suggestedReply)
        return reply.send({ suggestion: result, lead: await leadDetail(lead.id) });
      if (result.suggestedReply.length > policyValue.maxReplyLength)
        return reply.code(422).send({
          error: `Generated reply exceeded the ${policyValue.maxReplyLength}-character policy limit`,
        });
      await createRevision({
        leadId: lead.id,
        body: result.suggestedReply,
        postingIdentity,
        userId: request.user.sub,
        aiGenerated: true,
        generationMetadata: result as any,
      });
      return reply.code(201).send({ suggestion: result, lead: await leadDetail(lead.id) });
    },
  );

  app.post('/api/leads/:id/reply', { preHandler: requireAuth }, async (request: any, reply) => {
    const lead = await db.leadOpportunity.findUnique({ where: { id: request.params.id } });
    if (!lead || !(await canEdit(request.user.sub, lead.businessId)))
      return reply.code(404).send({ error: 'Opportunity not found' });
    const input = createLeadReplySchema.parse(request.body);
    await createRevision({
      leadId: lead.id,
      ...input,
      userId: request.user.sub,
      aiGenerated: false,
    });
    return reply.code(201).send(await leadDetail(lead.id));
  });

  app.patch('/api/lead-replies/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    const linked = await db.leadReply.findUnique({ where: { id: request.params.id } });
    if (!linked || !(await canEdit(request.user.sub, linked.businessId)))
      return reply.code(404).send({ error: 'Reply not found' });
    const input = updateLeadReplySchema.parse(request.body);
    if (linked.version !== input.expectedVersion)
      return reply.code(409).send({ error: 'This reply changed. Refresh and try again.' });
    await createRevision({
      leadId: linked.leadId,
      body: input.body,
      postingIdentity: input.postingIdentity,
      userId: request.user.sub,
      aiGenerated: false,
    });
    return leadDetail(linked.leadId);
  });

  app.post(
    '/api/lead-replies/:id/submit',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const linked = await db.leadReply.findUnique({
        where: { id: request.params.id },
        include: { currentRevision: true },
      });
      if (!linked || !(await canEdit(request.user.sub, linked.businessId)))
        return reply.code(404).send({ error: 'Reply not found' });
      if (!linked.currentRevision?.body.trim())
        return reply.code(409).send({ error: 'Write a reply before submitting it' });
      await db.$transaction(async (tx) => {
        await tx.contentItem.update({
          where: { id: linked.contentItemId },
          data: { status: 'NEEDS_REVIEW' },
        });
        await tx.recommendation.update({
          where: { id: linked.recommendationId },
          data: { status: 'OPEN' },
        });
        await logActivityStrict(tx, 'reply.submitted', {
          businessId: linked.businessId,
          userId: request.user.sub,
          entityType: 'LeadReply',
          entityId: linked.id,
          metadata: { revisionId: linked.currentRevisionId },
        });
      });
      return leadDetail(linked.leadId);
    },
  );

  app.post(
    '/api/lead-replies/:id/decisions',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const linked = await db.leadReply.findUnique({
        where: { id: request.params.id },
        include: { currentRevision: true, lead: true },
      });
      if (!linked || !(await canManage(request.user.sub, linked.businessId)))
        return reply.code(403).send({ error: 'Owner or manager access is required' });
      const input = leadDecisionSchema.parse(request.body);
      if (linked.version !== input.expectedVersion || linked.currentRevisionId !== input.revisionId)
        return reply
          .code(409)
          .send({ error: 'The reply changed. Review the latest revision before deciding.' });
      await db.$transaction(async (tx) => {
        if (linked.activeApprovalId)
          await tx.leadReplyApproval.update({
            where: { id: linked.activeApprovalId },
            data: { revokedAt: new Date(), revocationReason: 'Superseded by a new decision' },
          });
        const approval = await tx.leadReplyApproval.create({
          data: {
            replyId: linked.id,
            revisionId: input.revisionId,
            decision: input.decision,
            actorUserId: request.user.sub,
            reason: input.reason ?? null,
            sourceTextHash: linked.lead.sourceTextHash,
            postingIdentity: linked.currentRevision!.postingIdentity,
            policyVersion: linked.currentRevision!.policyVersion,
          },
        });
        await tx.leadReply.update({
          where: { id: linked.id },
          data: { activeApprovalId: input.decision === 'APPROVED' ? approval.id : null },
        });
        await tx.contentItem.update({
          where: { id: linked.contentItemId },
          data: { status: input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
        });
        await tx.recommendation.update({
          where: { id: linked.recommendationId },
          data: { status: input.decision },
        });
        await logActivityStrict(
          tx,
          input.decision === 'APPROVED' ? 'reply.approved' : 'reply.rejected',
          {
            businessId: linked.businessId,
            userId: request.user.sub,
            entityType: 'LeadReply',
            entityId: linked.id,
            metadata: { revisionId: input.revisionId, reason: input.reason ?? null },
          },
        );
      });
      return leadDetail(linked.leadId);
    },
  );

  app.post(
    '/api/lead-replies/:id/manual-publication',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      const linked = await db.leadReply.findUnique({
        where: { id: request.params.id },
        include: { currentRevision: true, activeApproval: true },
      });
      if (!linked || !(await canEdit(request.user.sub, linked.businessId)))
        return reply.code(404).send({ error: 'Reply not found' });
      if (!linked.currentRevision)
        return reply.code(409).send({ error: 'No reply revision exists' });
      const input = manualPublicationSchema.parse(request.body);
      const existing = await db.leadReplyPublication.findUnique({
        where: {
          businessId_idempotencyKey: {
            businessId: linked.businessId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) return reply.send(existing);
      const compliance = !linked.activeApproval
        ? 'UNAPPROVED'
        : sha256(input.actualText) === linked.currentRevision.bodyHash &&
            input.postingIdentity === linked.currentRevision.postingIdentity
          ? 'COMPLIANT'
          : 'DEVIATED';
      const publication = await db.$transaction(async (tx) => {
        const created = await tx.leadReplyPublication.create({
          data: {
            businessId: linked.businessId,
            replyId: linked.id,
            revisionId: linked.currentRevision!.id,
            approvalId: linked.activeApprovalId,
            actualText: input.actualText,
            actualTextHash: sha256(input.actualText),
            postingIdentity: input.postingIdentity,
            responseUrl: input.responseUrl ?? null,
            publishedAt: new Date(input.publishedAt),
            recordedById: request.user.sub,
            approvalCompliance: compliance,
            evidenceNote: input.evidenceNote ?? null,
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.contentItem.update({
          where: { id: linked.contentItemId },
          data: { status: 'PUBLISHED' },
        });
        await tx.recommendation.update({
          where: { id: linked.recommendationId },
          data: { status: 'COMPLETED' },
        });
        await tx.leadOpportunity.update({
          where: { id: linked.leadId },
          data: { status: 'CLOSED', version: { increment: 1 } },
        });
        await logActivityStrict(tx, 'reply.manual_publication_recorded', {
          businessId: linked.businessId,
          userId: request.user.sub,
          entityType: 'LeadReply',
          entityId: linked.id,
          metadata: { publicationId: created.id, compliance },
        });
        return created;
      });
      return reply.code(201).send(publication);
    },
  );

  app.get('/api/leads/:id/activity', { preHandler: requireAuth }, async (request: any, reply) => {
    const lead = await db.leadOpportunity.findUnique({
      where: { id: request.params.id },
      include: { reply: true },
    });
    if (!lead || !(await owns(request.user.sub, lead.businessId)))
      return reply.code(404).send({ error: 'Opportunity not found' });
    return db.activityLog.findMany({
      where: {
        businessId: lead.businessId,
        OR: [{ entityId: lead.id }, ...(lead.reply ? [{ entityId: lead.reply.id }] : [])],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  app.get(
    '/api/businesses/:id/outreach-policy',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await owns(request.user.sub, request.params.id)))
        return reply.code(404).send({ error: 'Business not found' });
      return (
        (await db.businessOutreachPolicy.findUnique({
          where: { businessId: request.params.id },
        })) ?? {
          version: 1,
          speakerName: request.user.name ?? '',
          speakerRole: '',
          allowBusinessName: true,
          allowPublicLinks: false,
          allowedUrls: [],
          approvedClaims: [],
          ctaStyle: 'Helpful and low pressure',
          excludedTopics: [],
          maxReplyLength: 1200,
        }
      );
    },
  );

  app.put(
    '/api/businesses/:id/outreach-policy',
    { preHandler: requireAuth },
    async (request: any, reply) => {
      if (!(await canManage(request.user.sub, request.params.id)))
        return reply.code(403).send({ error: 'Owner or manager access is required' });
      const input = outreachPolicySchema.parse(request.body);
      return db.businessOutreachPolicy.upsert({
        where: { businessId: request.params.id },
        create: { businessId: request.params.id, updatedById: request.user.sub, ...input },
        update: { updatedById: request.user.sub, version: { increment: 1 }, ...input },
      });
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
    if (input.type === 'LEAD_REPLY')
      return reply
        .code(400)
        .send({ error: 'Lead replies must be created from Lead Opportunities' });
    if (!(await canEdit(request.user.sub, input.businessId)))
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
    if (await db.leadReply.findUnique({ where: { contentItemId: item.id } }))
      return reply.code(409).send({
        error: 'Edit this item from Lead Opportunities so approval history remains accurate',
      });
    if (!(await canEdit(request.user.sub, item.businessId)))
      return reply.code(403).send({ error: 'Editor access is required' });
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
    if (await db.leadReply.findUnique({ where: { contentItemId: item.id } }))
      return reply.code(409).send({ error: 'Change lead-reply status from Lead Opportunities' });
    if (!(await canEdit(request.user.sub, item.businessId)))
      return reply.code(403).send({ error: 'Editor access is required' });
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
      if (await db.leadReply.findUnique({ where: { recommendationId: item.id } }))
        return reply
          .code(409)
          .send({ error: 'Review this recommendation from Lead Opportunities' });
      if (!(await canEdit(request.user.sub, item.businessId)))
        return reply.code(403).send({ error: 'Editor access is required' });
      const body = z
        .object({
          status: z.enum(['OPEN', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'DISMISSED', 'COMPLETED']),
          proposedValue: z.string().nullable().optional(),
        })
        .parse(request.body);
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
    if (!(await canEdit(request.user.sub, body.businessId)))
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
    if (!(await canEdit(request.user.sub, body.businessId)))
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

  if (config.NODE_ENV === 'production') {
    const moduleDirectory = dirname(fileURLToPath(import.meta.url));
    const webDirectory = resolve(moduleDirectory, '../../../web/dist');
    const indexPath = resolve(webDirectory, 'index.html');
    const fileExists = async (path: string) =>
      access(path).then(
        () => true,
        () => false,
      );
    if (!(await fileExists(indexPath))) {
      throw new Error(`Production web build not found at ${webDirectory}`);
    }
    const contentTypes: Record<string, string> = {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.ico': 'image/x-icon',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
    };
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      const pathname = decodeURIComponent(request.url.split('?')[0] ?? '/');
      const requestedPath = resolve(webDirectory, `.${pathname}`);
      const staysInsideWebBuild = relative(webDirectory, requestedPath).split(/[\\/]/)[0] !== '..';
      if (staysInsideWebBuild && extname(requestedPath) && (await fileExists(requestedPath))) {
        return reply
          .type(contentTypes[extname(requestedPath)] ?? 'application/octet-stream')
          .send(await readFile(requestedPath));
      }
      return reply.type('text/html; charset=utf-8').send(await readFile(indexPath));
    });
  }

  return app;
};
