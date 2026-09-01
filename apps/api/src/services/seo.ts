import type { Severity } from '@prisma/client';

export type AuditPage = {
  id: string;
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: unknown;
  h2: unknown;
  wordCount: number;
  images: unknown;
};
export type DetectedIssue = {
  pageId: string;
  severity: Severity;
  category: string;
  title: string;
  explanation: string;
  suggestedAction: string;
  code: string;
};
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export const detectPageIssues = (page: AuditPage): DetectedIssue[] => {
  const issues: DetectedIssue[] = [];
  const add = (
    severity: Severity,
    category: string,
    title: string,
    explanation: string,
    suggestedAction: string,
    code: string,
  ) =>
    issues.push({ pageId: page.id, severity, category, title, explanation, suggestedAction, code });
  if (!page.title?.trim())
    add(
      'HIGH',
      'Metadata',
      'Missing page title',
      'Search engines and visitors lack a clear page label.',
      'Write a unique, descriptive title of roughly 30–60 characters.',
      'missing-title',
    );
  else if (page.title.length < 30)
    add(
      'LOW',
      'Metadata',
      'Page title may be too short',
      'The title may not communicate enough context.',
      'Expand it while keeping the main topic prominent.',
      'short-title',
    );
  else if (page.title.length > 60)
    add(
      'MEDIUM',
      'Metadata',
      'Page title may be truncated',
      'Long titles are commonly shortened in search results.',
      'Reduce the title to its most useful wording.',
      'long-title',
    );
  if (!page.metaDescription?.trim())
    add(
      'MEDIUM',
      'Metadata',
      'Missing meta description',
      'Search results may select less useful page text.',
      'Add a distinct summary with a relevant call to action.',
      'missing-description',
    );
  else if (page.metaDescription.length > 160)
    add(
      'LOW',
      'Metadata',
      'Meta description may be truncated',
      'The description is longer than a typical search snippet.',
      'Keep the essential message within about 160 characters.',
      'long-description',
    );
  const h1 = list(page.h1);
  if (!h1.length)
    add(
      'HIGH',
      'Headings',
      'Missing H1',
      'The page has no clear primary heading.',
      'Add one descriptive H1 aligned with the page intent.',
      'missing-h1',
    );
  if (h1.length > 1)
    add(
      'MEDIUM',
      'Headings',
      'Multiple H1 headings',
      'Several primary headings make the content hierarchy less clear.',
      'Use one primary H1 and convert secondary headings to H2.',
      'multiple-h1',
    );
  if (page.wordCount < 150)
    add(
      'MEDIUM',
      'Content',
      'Very little page copy',
      'The page may not answer the visitor’s intent in enough depth.',
      'Add useful, original copy that supports the page purpose.',
      'thin-content',
    );
  const images = Array.isArray(page.images) ? (page.images as Array<{ alt?: string }>) : [];
  if (images.some((image) => !image.alt?.trim()))
    add(
      'LOW',
      'Accessibility',
      'Images missing alternative text',
      'Some images are not described for assistive technology.',
      'Add concise alt text to meaningful images; leave decorative images empty.',
      'missing-alt',
    );
  if (list(page.h2).length === 0 && page.wordCount > 400)
    add(
      'LOW',
      'Headings',
      'Long page lacks section headings',
      'Long copy is harder to scan without sections.',
      'Break the copy into descriptive H2 sections.',
      'weak-headings',
    );
  return issues;
};

type ScoredIssue = { severity: Severity; code?: string; fingerprint?: string; pageId?: string | null };

const severityWeight: Record<Severity, number> = {
  CRITICAL: 18,
  HIGH: 12,
  MEDIUM: 7,
  LOW: 3,
  OPPORTUNITY: 0,
};

export const calculateHealthScore = (issues: ScoredIssue[], pagesAudited: number) => {
  const pageCount = Math.max(1, pagesAudited);
  const groups = new Map<string, { severity: Severity; pages: Set<string> }>();
  issues.forEach((issue, index) => {
    const code = issue.code ?? issue.fingerprint?.split(':').at(-1) ?? `finding-${index}`;
    const group = groups.get(code) ?? { severity: issue.severity, pages: new Set<string>() };
    group.pages.add(issue.pageId ?? `page-${index}`);
    groups.set(code, group);
  });
  const deductions = [...groups.entries()].map(([code, group]) => {
    const affectedPages = Math.min(pageCount, group.pages.size);
    const prevalence = affectedPages / pageCount;
    // One occurrence carries half the potential impact; repetition increases it gradually to 100%.
    const points = severityWeight[group.severity] * (0.5 + 0.5 * prevalence);
    return { code, severity: group.severity, affectedPages, points: Math.round(points * 10) / 10 };
  });
  const penalty = Math.round(deductions.reduce((sum, item) => sum + item.points, 0));
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Needs attention' : 'Poor';
  const bySeverity = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((severity) => ({
    severity,
    findings: issues.filter((issue) => issue.severity === severity).length,
    groupedChecks: deductions.filter((item) => item.severity === severity).length,
    pointsDeducted: Math.round(deductions.filter((item) => item.severity === severity)
      .reduce((sum, item) => sum + item.points, 0) * 10) / 10,
  }));
  return { score, label, pagesAudited, uniqueChecks: groups.size, penalty, bySeverity };
};

export const healthScore = (issues: ScoredIssue[], pagesAudited = 1) =>
  calculateHealthScore(issues, pagesAudited).score;
