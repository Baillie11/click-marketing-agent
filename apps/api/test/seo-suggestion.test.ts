import { describe, expect, it } from 'vitest';
import { createRuleBasedSeoSuggestion } from '../src/services/seo-suggestion.js';

const context = {
  business: {
    name: 'Puzzle Path',
    industry: 'Tourism and local experiences',
    location: 'Gold Coast, Queensland',
    description: 'Scavenger hunts, tourism, local experiences and group activities.',
    mainCta: 'Book an experience',
    keywords: ['Gold Coast scavenger hunts'],
  },
  issue: {
    title: 'Missing page title',
    category: 'Metadata',
    explanation: 'A clear label is missing.',
  },
  page: {
    url: 'https://www.puzzlepath.com.au/about',
    title: null,
    metaDescription: null,
    h1: ['About'],
    h2: [],
    visibleText: 'About Puzzle Path and our Gold Coast experiences.',
    wordCount: 42,
  },
};

describe('rule-based SEO suggestions', () => {
  it('provides actual title content for an About page', () => {
    const suggestion = createRuleBasedSeoSuggestion(context);
    expect(suggestion.targetField).toBe('SEO page title');
    expect(suggestion.proposedValue).toContain('About Puzzle Path');
    expect(suggestion.proposedValue.length).toBeLessThanOrEqual(60);
  });
  it('provides actual meta-description content within the recommended length', () => {
    const suggestion = createRuleBasedSeoSuggestion({
      ...context,
      issue: { ...context.issue, title: 'Missing meta description' },
    });
    expect(suggestion.targetField).toBe('Meta description');
    expect(suggestion.proposedValue).toContain('Book an experience');
    expect(suggestion.proposedValue.length).toBeLessThanOrEqual(160);
  });
});
