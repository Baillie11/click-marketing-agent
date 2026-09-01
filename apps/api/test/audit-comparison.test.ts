import { describe, expect, it } from 'vitest';
import { compareAuditIssues } from '../src/services/audit-comparison.js';

const issue = (crawlId: string, url: string, code: string) => ({
  fingerprint: `${crawlId}:page:${code}`,
  title: code,
  page: { url },
});

describe('audit comparison', () => {
  it('does not add identical findings from repeated crawl snapshots', () => {
    const previous = [issue('crawl-1', '/about', 'missing-title'), issue('crawl-1', '/', 'thin-copy')];
    const current = [issue('crawl-2', '/about', 'missing-title'), issue('crawl-2', '/', 'thin-copy')];
    expect(compareAuditIssues(current, previous)).toEqual({
      current: 2, previous: 2, fixed: 0, stillPresent: 2, new: 0,
    });
  });

  it('reports fixed and new findings between snapshots', () => {
    const previous = [issue('old', '/about', 'missing-title'), issue('old', '/', 'thin-copy')];
    const current = [issue('new', '/', 'thin-copy'), issue('new', '/contact', 'missing-description')];
    expect(compareAuditIssues(current, previous)).toMatchObject({ fixed: 1, stillPresent: 1, new: 1 });
  });
});
