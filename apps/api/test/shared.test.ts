import { describe, it, expect } from 'vitest';
import { businessSchema, contentTransitionSchema, generateArticleSchema, registerSchema } from '@click/shared';
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
});
