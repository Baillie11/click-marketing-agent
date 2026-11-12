import { describe, it, expect } from 'vitest';
import { accountPasswordSchema, accountProfileSchema, businessSchema, captureLeadSchema, contentTransitionSchema, forgotPasswordSchema, generateArticleSchema, leadDecisionSchema, manualPublicationSchema, registerSchema, resetPasswordSchema } from '@click/shared';
describe('domain validation', () => {
  it('requires strong-enough registration input', () =>
    expect(registerSchema.safeParse({ name: 'A', email: 'bad', password: 'short' }).success).toBe(
      false,
    ));
  it('validates business URLs', () =>
    expect(businessSchema.safeParse({ name: 'Test', websiteUrl: 'not-url' }).success).toBe(false));
  it('rejects unknown content statuses', () =>
    expect(contentTransitionSchema.safeParse({ status: 'DELETED' }).success).toBe(false));
  it('defaults articles to a natural editorial style and validates explicit styles', () => {
    expect(generateArticleSchema.parse({ topic: 'Family activities' }).style).toBe('NATURAL_EDITORIAL');
    expect(generateArticleSchema.safeParse({ topic: 'Family activities', style: 'NEWS_FEATURE' }).success).toBe(true);
    expect(generateArticleSchema.safeParse({ topic: 'Family activities', style: 'KEYWORD_STUFFED' }).success).toBe(false);
  });
  it('normalises account emails and requires current-password confirmation', () => {
    expect(accountProfileSchema.parse({ name: 'Demo Owner', email: 'DEMO@Example.com', currentPassword: 'old password' }).email).toBe('demo@example.com');
    expect(accountProfileSchema.safeParse({ name: 'Demo Owner', email: 'bad', currentPassword: '' }).success).toBe(false);
  });
  it('requires a new, matching account password', () => {
    expect(accountPasswordSchema.safeParse({ currentPassword: 'CurrentPass1!', newPassword: 'NewPassword2!', confirmPassword: 'NewPassword2!' }).success).toBe(true);
    expect(accountPasswordSchema.safeParse({ currentPassword: 'CurrentPass1!', newPassword: 'NewPassword2!', confirmPassword: 'different' }).success).toBe(false);
    expect(accountPasswordSchema.safeParse({ currentPassword: 'SamePassword1!', newPassword: 'SamePassword1!', confirmPassword: 'SamePassword1!' }).success).toBe(false);
  });
  it('validates password recovery without exposing account existence', () => {
    expect(forgotPasswordSchema.parse({ email: 'DEMO@Example.com' }).email).toBe('demo@example.com');
    expect(resetPasswordSchema.safeParse({ token: 'a'.repeat(40), newPassword: 'NewPassword2!', confirmPassword: 'NewPassword2!' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: 'short', newPassword: 'NewPassword2!', confirmPassword: 'different' }).success).toBe(false);
  });
  it('validates lead capture and approval contracts', () => {
    expect(captureLeadSchema.safeParse({ platform: 'REDDIT', originalUrl: 'https://reddit.com/r/test/comments/abc', postText: 'Can someone recommend a developer?' }).success).toBe(true);
    expect(captureLeadSchema.safeParse({ platform: 'UNKNOWN', originalUrl: 'bad', postText: 'short' }).success).toBe(false);
    expect(leadDecisionSchema.safeParse({ decision: 'REJECTED', revisionId: crypto.randomUUID(), expectedVersion: 1 }).success).toBe(false);
  });
  it('requires publication evidence and an idempotency key', () => {
    expect(manualPublicationSchema.safeParse({ actualText: 'Helpful reply', postingIdentity: 'Andrew', publishedAt: new Date().toISOString(), idempotencyKey: 'publication-1' }).success).toBe(true);
    expect(manualPublicationSchema.safeParse({ actualText: '', postingIdentity: 'A', publishedAt: 'today', idempotencyKey: 'x' }).success).toBe(false);
  });
});
