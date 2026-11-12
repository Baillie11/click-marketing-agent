import { describe, expect, it } from 'vitest';
import { selectVisualAuditUrls } from '../src/services/visual-capture.js';

describe('visual audit URL selection', () => {
  it('prioritises home, About and Contact while removing duplicates', () => {
    const urls = selectVisualAuditUrls([
      'https://example.com/tours',
      'https://example.com/contact-us',
      'https://example.com/',
      'https://example.com/about-us',
      'https://example.com/',
    ], 4);
    expect(urls).toEqual([
      'https://example.com/',
      'https://example.com/about-us',
      'https://example.com/contact-us',
      'https://example.com/tours',
    ]);
  });
});
