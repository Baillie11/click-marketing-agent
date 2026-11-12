import { afterEach, describe, expect, it, vi } from 'vitest';
import { WordPressPublisher } from '../src/services/wordpress-connector.js';

const publisher = new WordPressPublisher('https://example.com', 'user', 'pass');

// Stub the two network boundaries: DNS safety check + global fetch.
vi.mock('../src/lib/url.js', () => ({ assertSafePublicUrl: vi.fn(async () => new URL('https://example.com')) }));

const resource = {
  id: 7,
  type: 'pages',
  title: { rendered: 'Original title' },
  excerpt: { rendered: 'Original excerpt' },
  content: { rendered: '<p>Body</p>', raw: '<p>Body</p>' },
  link: 'https://example.com/book-today',
};

const mockFindResource = () => {
  const findResource = vi.fn().mockResolvedValue(resource);
  (publisher as any).findResource = findResource;
  return findResource;
};

const mockPost = () => {
  const calls: Record<string, unknown>[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.method === 'POST' && String(_url).includes('/wp/v2/pages/')) {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ id: resource.id }), { status: 200 });
    }
    // purgeCache + any other calls
    return new Response('{}', { status: 200 });
  });
  return { calls, spy };
};

afterEach(() => vi.restoreAllMocks());

describe('WordPressPublisher.apply safety', () => {
  it('applies a plain-text SEO title to the title field', async () => {
    mockFindResource();
    const { calls } = mockPost();
    await publisher.apply({ targetUrl: 'https://example.com/book-today', field: 'SEO_TITLE', expectedCurrentValue: null, proposedValue: 'A clean title' });
    expect(calls[0]?.title).toBe('A clean title');
  });

  it('refuses to write HTML into the title field', async () => {
    mockFindResource();
    mockPost();
    await expect(
      publisher.apply({ targetUrl: 'https://example.com/book-today', field: 'SEO_TITLE', expectedCurrentValue: null, proposedValue: '<h2>What you’ll find</h2><p>text</p>' }),
    ).rejects.toThrow(/HTML/);
  });

  it('does not clobber the title when applying an H1 — it prepends into content', async () => {
    mockFindResource();
    const { calls } = mockPost();
    await publisher.apply({ targetUrl: 'https://example.com/book-today', field: 'H1', expectedCurrentValue: null, proposedValue: 'Book a scavenger hunt' });
    expect(calls[0]?.title).toBeUndefined();
    expect(String(calls[0]?.content)).toContain('<h1>Book a scavenger hunt</h1>');
    expect(String(calls[0]?.content)).toContain('<p>Body</p>');
  });

  it('rejects an H1 that is really a block of markup', async () => {
    mockFindResource();
    mockPost();
    await expect(
      publisher.apply({ targetUrl: 'https://example.com/book-today', field: 'H1', expectedCurrentValue: null, proposedValue: '<h2>What you’ll find here</h2><p>Short descriptions</p>' }),
    ).rejects.toThrow(/markup/);
  });

  it('rejects unsupported fields instead of forcing them into the title', async () => {
    mockFindResource();
    mockPost();
    await expect(
      publisher.apply({ targetUrl: 'https://example.com/book-today', field: 'ALT_TEXT', expectedCurrentValue: null, proposedValue: 'alt text' }),
    ).rejects.toThrow(/does not support/);
  });

  it('applies a plain-text meta description to the excerpt field', async () => {
    mockFindResource();
    const { calls } = mockPost();
    await publisher.apply({ targetUrl: 'https://example.com/book-today', field: 'META_DESCRIPTION', expectedCurrentValue: null, proposedValue: 'A short description under the limit.' });
    expect(calls[0]?.excerpt).toBe('A short description under the limit.');
    expect(calls[0]?.title).toBeUndefined();
  });
});
