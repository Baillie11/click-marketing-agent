import { describe, it, expect } from 'vitest';
import { normaliseUrl, sameDomain, assertSafePublicUrl } from '../src/lib/url.js';
describe('crawler URLs', () => {
  it('normalises fragments, tracking and trailing slash', () =>
    expect(normaliseUrl('/offers/?utm_source=x#top', 'https://Example.com/')).toBe(
      'https://example.com/offers',
    ));
  it('restricts navigation to the same registrable host variant', () => {
    expect(sameDomain('https://www.example.com/a', 'https://example.com')).toBe(true);
    expect(sameDomain('https://evil.example/a', 'https://example.com')).toBe(false);
  });
  it('blocks localhost without resolving it', async () =>
    await expect(assertSafePublicUrl('http://localhost/admin')).rejects.toThrow('Private'));
});
