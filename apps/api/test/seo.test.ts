import { describe, it, expect } from 'vitest';
import { calculateHealthScore, detectPageIssues, healthScore } from '../src/services/seo.js';
const page = {
  id: 'p',
  url: 'https://example.com',
  title: null,
  metaDescription: null,
  h1: [],
  h2: [],
  wordCount: 20,
  images: [{ src: 'x', alt: '' }],
};
describe('SEO analysis', () => {
  it('detects measurable issues', () => {
    const codes = detectPageIssues(page).map((x) => x.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'missing-title',
        'missing-description',
        'missing-h1',
        'thin-content',
        'missing-alt',
      ]),
    );
  });
  it('uses transparent bounded scoring', () =>
    expect(healthScore([{ severity: 'HIGH' }, { severity: 'MEDIUM' }])).toBe(81));
  it('groups repeated checks and normalizes their impact by pages audited', () => {
    const result = calculateHealthScore([
      { severity: 'HIGH', code: 'missing-title', pageId: 'one' },
      { severity: 'HIGH', code: 'missing-title', pageId: 'two' },
      { severity: 'HIGH', code: 'missing-title', pageId: 'three' },
      { severity: 'HIGH', code: 'missing-title', pageId: 'four' },
    ], 5);
    expect(result.score).toBe(89);
    expect(result.uniqueChecks).toBe(1);
    expect(result.bySeverity.find((row) => row.severity === 'HIGH')).toMatchObject({
      findings: 4,
      groupedChecks: 1,
      pointsDeducted: 10.8,
    });
  });
});
