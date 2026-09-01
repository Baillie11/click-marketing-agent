type SuggestionContext = {
  business: {
    name: string;
    industry: string;
    location: string;
    description: string;
    mainCta: string;
    keywords: unknown;
  };
  issue: { title: string; category: string; explanation: string };
  page: {
    url: string;
    title: string | null;
    metaDescription: string | null;
    h1: unknown;
    h2: unknown;
    visibleText: string;
    wordCount: number;
  };
};

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const limit = (value: string, length: number) => {
  const text = clean(value);
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1).replace(/\s+\S*$/, '')}…`;
};
const pageLabel = (url: string) => {
  const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1);
  if (!segment) return 'Home';
  return segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const createRuleBasedSeoSuggestion = ({ business, issue, page }: SuggestionContext) => {
  const finding = issue.title.toLowerCase();
  const h1 = strings(page.h1);
  const h2 = strings(page.h2);
  const keyword = strings(business.keywords)[0];
  const subject = h1[0] || pageLabel(page.url);
  const qualifier = keyword || business.industry || business.location;
  let targetField = 'Page content';
  let proposedValue = '';
  let rationale = '';

  if (finding.includes('title')) {
    targetField = 'SEO page title';
    const isAbout = /\babout\b/i.test(subject) || /\/about\/?$/i.test(new URL(page.url).pathname);
    proposedValue = limit(
      isAbout
        ? `About ${business.name} | ${qualifier}`
        : `${subject}${subject.toLowerCase().includes(business.name.toLowerCase()) ? '' : ` | ${business.name}`}`,
      60,
    );
    rationale = `This gives the page a specific topic, includes the business name where useful, and stays within the audit's recommended title length.`;
  } else if (finding.includes('meta description')) {
    targetField = 'Meta description';
    const description = clean(business.description).replace(/\.$/, '');
    proposedValue = limit(
      `${subject}: ${description}. ${business.mainCta || 'Learn more today'}.`,
      160,
    );
    rationale = 'This provides a clear search-result summary and a relevant call to action.';
  } else if (finding.includes('h1')) {
    targetField = 'Primary H1 heading';
    proposedValue = page.title?.split('|')[0]?.trim() || `${subject} – ${business.name}`;
    rationale = 'This gives visitors and search engines one clear primary heading for the page.';
  } else if (finding.includes('section heading')) {
    targetField = 'Suggested H2 sections';
    proposedValue = [
      `What ${business.name} Offers`,
      `Who It Is For`,
      `Why Choose ${business.name}`,
      business.mainCta
        ? `How to ${business.mainCta.replace(/^./, (c) => c.toLowerCase())}`
        : 'How to Get Started',
    ].join('\n');
    rationale =
      'These sections create a scannable structure around the business, audience, value and next step.';
  } else if (finding.includes('copy') || finding.includes('little')) {
    targetField = 'Expanded page copy outline';
    proposedValue = [
      `${subject}`,
      '',
      `${business.name} ${clean(business.description).replace(/^./, (c) => c.toLowerCase())}`,
      '',
      `## What We Offer`,
      `Explain the most relevant services or experiences for this page, with concrete details that help the visitor decide whether it suits them.`,
      '',
      `## Who It Is For`,
      `Describe the customers this page serves and the outcome they are trying to achieve.`,
      '',
      `## Next Step`,
      `${business.mainCta || 'Invite the visitor to take the next appropriate action.'}`,
    ].join('\n');
    rationale = `The page currently has ${page.wordCount} words. This outline adds useful decision-making content rather than filler.`;
  } else if (finding.includes('alternative text')) {
    targetField = 'Image alt text';
    proposedValue = `Describe each meaningful image in the context of ${subject}; for example: “${business.name} ${qualifier} experience”. Decorative images should use an empty alt attribute.`;
    rationale =
      'Accurate alt text must describe the actual image, so this is a pattern to review rather than text to apply blindly.';
  } else {
    proposedValue = h2.length
      ? `Retain the strongest existing structure (${h2.slice(0, 3).join(', ')}) and apply: ${issue.explanation}`
      : `Update ${subject} using the page purpose, ${business.name} brand context and the recommended action.`;
    rationale =
      'This is a context-aware starting point and should be reviewed against the live page.';
  }

  return { targetField, proposedValue, rationale, source: 'RULE_BASED' as const };
};
