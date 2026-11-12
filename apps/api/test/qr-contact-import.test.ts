import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(), updateToken: vi.fn(), upsert: vi.fn(), updateContact: vi.fn(),
}));
vi.mock('../src/db.js', () => ({ db: {
  integrationToken: { findFirst: mocks.findFirst },
  $transaction: async (run: any) => run({
    integrationToken: { update: mocks.updateToken },
    contact: { upsert: mocks.upsert, update: mocks.updateContact },
  }),
} }));
import { qrContactSchema, registerQrContactImport } from '../src/services/qr-contact-import.js';
const businessId = 'b3a7f49e-3cb9-42bd-9c30-466d87baa504';
const payload = { businessId, email: 'Test@example.com', contactName: 'Test User', businessName: 'Test Business',
  website: 'https://example.com/', source: 'qr-code-generator', sourceId: `qr:${'a'.repeat(32)}` };
describe('QR contact imports', () => {
  let app: FastifyInstance;
  beforeEach(() => {
    vi.resetAllMocks();
    app = Fastify(); registerQrContactImport(app);
    mocks.findFirst.mockResolvedValue({ id: 'token', businessId });
    mocks.upsert.mockResolvedValue({ id: 'contact', contactName: '', businessName: '', website: null });
    mocks.updateContact.mockResolvedValue({ id: 'contact' });
  });
  afterEach(async () => { await app.close(); });
  const request = (app: FastifyInstance, body = payload, token = 'test-token') => app.inject({
    method: 'POST', url: '/api/integrations/qr-code-generator/contacts', payload: body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  it('rejects missing/revoked tokens and wrong business scope', async () => {
    expect((await request(app, payload, '')).statusCode).toBe(401);
    mocks.findFirst.mockResolvedValueOnce(null);
    expect((await request(app)).statusCode).toBe(401);
    expect((await request(app, { ...payload, businessId: '1ef7279a-65e6-46d6-ac9f-34cf75b4b1e9' })).statusCode).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('imports all fields and deduplicates on normalized email', async () => {
    expect((await request(app)).json()).toEqual({ id: 'contact' });
    expect((await request(app)).statusCode).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId_normalizedEmail: { businessId, normalizedEmail: 'test@example.com' } },
      create: { ...payload, normalizedEmail: 'test@example.com', contactNumber: '' }, update: {},
    }));
  });
  it('preserves existing details and never resurrects deleted contacts', async () => {
    mocks.upsert.mockResolvedValueOnce({ id: 'contact', contactName: 'Existing', businessName: 'Existing Co', website: 'https://existing.test', source: 'manual', sourceId: 'old' });
    await request(app);
    expect(mocks.updateContact).toHaveBeenCalledWith({ where: { id: 'contact' }, data: {
      contactName: 'Existing', businessName: 'Existing Co', website: 'https://existing.test', source: 'manual', sourceId: 'old',
    } });
    mocks.updateContact.mockClear();
    mocks.upsert.mockResolvedValueOnce({ id: 'contact', suppressedAt: new Date() });
    expect((await request(app)).statusCode).toBe(204);
    expect(mocks.updateContact).not.toHaveBeenCalled();
  });
  it('rejects invalid URLs and payloads', () => {
    for (const changes of [{ website: 'javascript:alert(1)' }, { email: 'bad' }, { businessName: '' }, { source: 'click-mail-monitor' }]) {
      expect(qrContactSchema.safeParse({ ...payload, ...changes }).success).toBe(false);
    }
  });
});
