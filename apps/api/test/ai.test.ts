import { describe, it, expect } from 'vitest';
import {
  articleOutputSchema,
  seoSuggestionOutputSchema,
  socialOutputSchema,
} from '../src/services/ai.js';
describe('AI validation', () => {
  it('rejects incomplete article JSON', () =>
    expect(articleOutputSchema.safeParse({ suggestedTitle: 'Only one field' }).success).toBe(
      false,
    ));
  it('accepts three distinct social fields', () =>
    expect(
      socialOutputSchema.safeParse({ facebook: 'a', linkedin: 'b', reddit: 'c' }).success,
    ).toBe(true));
  it('requires concrete structured SEO suggestion content', () => {
    expect(
      seoSuggestionOutputSchema.safeParse({
        targetField: 'SEO page title',
        proposedValue: 'About Puzzle Path | Gold Coast Scavenger Hunts',
        rationale: 'Clear and specific.',
      }).success,
    ).toBe(true);
    expect(seoSuggestionOutputSchema.safeParse({ rationale: 'Generic advice only' }).success).toBe(
      false,
    );
  });
});
