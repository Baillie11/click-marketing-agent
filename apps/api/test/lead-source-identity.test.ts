import { describe, expect, it } from 'vitest';
import { canonicalLeadUrl, leadSourceIdentity, sha256 } from '../src/services/lead-source-identity.js';

describe('lead source identity', () => {
  it('removes tracking parameters and normalises known Reddit hosts', () => {
    expect(canonicalLeadUrl('https://www.old.reddit.com/r/test/comments/abc/title/?utm_source=x&fbclid=y')).toBe(
      'https://reddit.com/r/test/comments/abc/title',
    );
  });

  it('produces the same source identity for equivalent URLs', () => {
    const first = leadSourceIdentity('REDDIT', 'https://www.reddit.com/r/test/comments/abc/?utm_medium=social');
    const second = leadSourceIdentity('reddit', 'https://reddit.com/r/test/comments/abc');
    expect(first.sourceKeyHash).toBe(second.sourceKeyHash);
  });

  it('creates stable SHA-256 hashes', () => {
    expect(sha256('reply')).toHaveLength(64);
    expect(sha256('reply')).toBe(sha256('reply'));
  });
});
