import OpenAI from 'openai';
import { z } from 'zod';
import { db } from '../db.js';
import { logActivity } from './activity.js';

export const articleOutputSchema = z.object({
  suggestedTitle: z.string(),
  seoTitle: z.string(),
  urlSlug: z.string(),
  metaDescription: z.string(),
  primaryTopic: z.string(),
  targetAudience: z.string(),
  introduction: z.string(),
  outline: z.array(z.object({ h2: z.string(), h3: z.array(z.string()) })),
  articleContent: z.string(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
  cta: z.string(),
  internalLinks: z.array(z.object({ anchorText: z.string(), url: z.string() })),
  socialPosts: z.object({ facebook: z.string(), linkedin: z.string(), reddit: z.string() }),
});
export const socialOutputSchema = z.object({
  facebook: z.string(),
  linkedin: z.string(),
  reddit: z.string(),
});
export const seoSuggestionOutputSchema = z.object({
  targetField: z.string(),
  proposedValue: z.string(),
  rationale: z.string(),
});

const articleJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'suggestedTitle',
    'seoTitle',
    'urlSlug',
    'metaDescription',
    'primaryTopic',
    'targetAudience',
    'introduction',
    'outline',
    'articleContent',
    'faq',
    'cta',
    'internalLinks',
    'socialPosts',
  ],
  properties: {
    suggestedTitle: { type: 'string' },
    seoTitle: { type: 'string' },
    urlSlug: { type: 'string' },
    metaDescription: { type: 'string' },
    primaryTopic: { type: 'string' },
    targetAudience: { type: 'string' },
    introduction: { type: 'string' },
    outline: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['h2', 'h3'],
        properties: { h2: { type: 'string' }, h3: { type: 'array', items: { type: 'string' } } },
      },
    },
    articleContent: { type: 'string' },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer'],
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
      },
    },
    cta: { type: 'string' },
    internalLinks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['anchorText', 'url'],
        properties: { anchorText: { type: 'string' }, url: { type: 'string' } },
      },
    },
    socialPosts: {
      type: 'object',
      additionalProperties: false,
      required: ['facebook', 'linkedin', 'reddit'],
      properties: {
        facebook: { type: 'string' },
        linkedin: { type: 'string' },
        reddit: { type: 'string' },
      },
    },
  },
} as const;
const socialJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['facebook', 'linkedin', 'reddit'],
  properties: {
    facebook: { type: 'string' },
    linkedin: { type: 'string' },
    reddit: { type: 'string' },
  },
} as const;
const seoSuggestionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['targetField', 'proposedValue', 'rationale'],
  properties: {
    targetField: { type: 'string' },
    proposedValue: { type: 'string' },
    rationale: { type: 'string' },
  },
} as const;

export class AiService {
  private client: OpenAI;
  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey, timeout: 45000, maxRetries: 2 });
  }
  private async context(businessId: string) {
    const business = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      include: {
        brandVoice: true,
        website: {
          include: {
            pages: { take: 30, orderBy: { fetchedAt: 'desc' }, select: { url: true, title: true } },
          },
        },
      },
    });
    return JSON.stringify({
      name: business.name,
      website: business.websiteUrl,
      description: business.description,
      industry: business.industry,
      location: business.location,
      audience: business.targetAudience,
      offerings: business.productsServices,
      goals: [business.primaryGoal, ...((business.secondaryGoals as string[]) ?? [])],
      keywords: business.keywords,
      mainCta: business.mainCta,
      brandVoice: business.brandVoice,
      existingPages: business.website?.pages ?? [],
    });
  }
  private async generate<T>(
    businessId: string,
    task: string,
    schemaName: string,
    schema: Record<string, unknown>,
    validator: z.ZodType<T>,
  ) {
    await logActivity('ai.requested', { businessId, metadata: { task: schemaName } });
    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions:
          'You are a careful small-business marketing assistant. Follow the supplied business context, use Australian English unless configured otherwise, avoid unsupported factual claims, and frame Reddit copy as a genuinely helpful non-promotional contribution.',
        input: `BUSINESS CONTEXT\n${await this.context(businessId)}\n\nTASK\n${task}`,
        text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
      });
      const result = validator.parse(JSON.parse(response.output_text));
      await logActivity('ai.succeeded', { businessId, metadata: { task: schemaName } });
      return result;
    } catch (error) {
      await logActivity('ai.failed', {
        businessId,
        metadata: { task: schemaName, message: error instanceof Error ? error.message : 'unknown' },
      });
      throw error;
    }
  }
  article(
    businessId: string,
    topic: string,
    audience?: string,
    style: 'NATURAL_EDITORIAL' | 'NEWS_FEATURE' | 'PRACTICAL_GUIDE' = 'NATURAL_EDITORIAL',
  ) {
    const styleDirection = {
      NATURAL_EDITORIAL:
        'Write as a polished Australian magazine or local publication feature: warm, observant, conversational and cohesive. Lead with an engaging human angle and carry one narrative thread from opening to conclusion.',
      NEWS_FEATURE:
        'Write in a natural journalistic feature style with a strong lead, clear context and an informative narrative. Do not imply that an event is recent, and do not invent dates, quotes, interviews, statistics or breaking-news claims.',
      PRACTICAL_GUIDE:
        'Write a genuinely useful guide in flowing prose. Use a short list only where readers truly need steps or a checklist; connect advice with explanatory transitions and realistic context.',
    }[style];
    return this.generate(
      businessId,
      `Create a substantive, publish-ready article draft about: ${topic}.
Intended audience: ${audience ?? 'use the business profile'}.
Writing direction: ${styleDirection}

ARTICLECONTENT REQUIREMENTS
- Write natural Australian English with varied sentence length and rhythm.
- Build one coherent argument or story. Every section must flow logically into the next with natural transitions.
- Prefer paragraphs over bullet lists. Use no more than four H2 headings and avoid excessive H3 headings.
- Do not repeat the introduction, summarise every section, or use canned phrases such as "in today's fast-paced world", "whether you're", or "look no further".
- Avoid a catalogue of generic tips. Add useful specificity only when supported by the supplied business context; never invent facts.
- Mention the business sparingly and naturally where it genuinely helps the reader. Do not force the product into unrelated paragraphs.
- End with a proportionate, human call to action—not a repetitive sales pitch.
- articleContent must contain the complete article, including its opening and conclusion, in Markdown. Aim for roughly 900–1,300 words when the topic supports it.
- Suggestions require human review before publication.`,
      'seo_article',
      articleJsonSchema,
      articleOutputSchema,
    );
  }
  social(businessId: string, topic: string) {
    return this.generate(
      businessId,
      `Create distinct platform-appropriate social content about: ${topic}. Facebook should be conversational; LinkedIn professional; Reddit helpful and community-first with no spam.`,
      'social_content',
      socialJsonSchema,
      socialOutputSchema,
    );
  }
  seoSuggestion(
    businessId: string,
    issue: { title: string; explanation: string; suggestedAction: string },
    page: {
      url: string;
      title: string | null;
      metaDescription: string | null;
      h1: unknown;
      h2: unknown;
      visibleText: string;
    },
  ) {
    return this.generate(
      businessId,
      `Propose the actual replacement content for this SEO finding. Return only one practical change, not generic advice. Keep page titles at 60 characters or fewer and meta descriptions at 160 characters or fewer. Do not invent facts.\n\nFINDING\n${JSON.stringify(issue)}\n\nPAGE\n${JSON.stringify({ ...page, visibleText: page.visibleText.slice(0, 12000) })}`,
      'seo_content_suggestion',
      seoSuggestionJsonSchema,
      seoSuggestionOutputSchema,
    );
  }
}
