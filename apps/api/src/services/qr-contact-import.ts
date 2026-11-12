import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';

export const qrContactSchema = z.object({
  businessId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  contactName: z.string().trim().min(1).max(150),
  businessName: z.string().trim().min(1).max(150),
  website: z.string().trim().url().max(2048).refine(value => /^https?:\/\//i.test(value)),
  source: z.literal('qr-code-generator'),
  sourceId: z.string().regex(/^qr:[a-f0-9]{32}$/),
});

export function registerQrContactImport(app: FastifyInstance) {
  app.post('/api/integrations/qr-code-generator/contacts', async (request, reply) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer '))
      return reply.code(401).send({ error: 'Integration token required' });
    const tokenHash = createHash('sha256').update(authorization.slice(7).trim()).digest('hex');
    const integration = await db.integrationToken.findFirst({ where: { tokenHash, revokedAt: null } });
    if (!integration) return reply.code(401).send({ error: 'Invalid integration token' });
    const input = qrContactSchema.parse(request.body);
    if (input.businessId !== integration.businessId)
      return reply.code(403).send({ error: 'Token is not authorised for this business' });
    const normalizedEmail = input.email.toLowerCase();
    const contact = await db.$transaction(async tx => {
      await tx.integrationToken.update({ where: { id: integration.id }, data: { lastUsedAt: new Date() } });
      // The unique email key makes retries converge on one contact. Never resurrect suppressed contacts.
      const existing = await tx.contact.upsert({
        where: { businessId_normalizedEmail: { businessId: input.businessId, normalizedEmail } },
        create: { ...input, normalizedEmail, contactNumber: '' },
        update: {},
      });
      if (existing.suppressedAt) return existing;
      return tx.contact.update({ where: { id: existing.id }, data: {
        contactName: existing.contactName || input.contactName,
        businessName: existing.businessName || input.businessName,
        website: existing.website || input.website,
        source: existing.source ?? input.source,
        sourceId: existing.sourceId ?? input.sourceId,
      } });
    });
    if (contact.suppressedAt) return reply.code(204).send();
    return reply.send({ id: contact.id });
  });
}
