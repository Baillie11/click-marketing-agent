import { z } from 'zod';

export const contentStatuses = ['IDEA', 'DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED'] as const;
export const contentTypes = ['SEO_ARTICLE', 'WEBSITE_REWRITE', 'FACEBOOK_POST', 'LINKEDIN_POST', 'REDDIT_RESPONSE', 'CAMPAIGN_IDEA', 'EMAIL_NEWSLETTER', 'SOCIAL_POST'] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const businessSchema = z.object({
  name: z.string().trim().min(2).max(150), websiteUrl: z.string().url(),
  description: z.string().max(5000).default(''), industry: z.string().max(150).default(''),
  location: z.string().max(250).default(''), targetAudience: z.string().max(2000).default(''),
  productsServices: z.string().max(3000).default(''), primaryGoal: z.string().max(1000).default(''),
  secondaryGoals: z.array(z.string().max(500)).default([]), brandTone: z.string().max(1000).default(''),
  keywords: z.array(z.string().max(100)).default([]), mainCta: z.string().max(500).default(''),
});
export const contentSchema = z.object({
  businessId: z.string().uuid(), title: z.string().min(2).max(255),
  type: z.enum(contentTypes), status: z.enum(contentStatuses).default('DRAFT'), body: z.string().default(''),
  scheduledAt: z.string().datetime().nullable().optional(), tags: z.array(z.string()).default([]), notes: z.string().default(''),
});
export const contentTransitionSchema = z.object({ status: z.enum(contentStatuses) });
export const crawlRequestSchema = z.object({ maxPages: z.number().int().min(1).max(100).optional() });
export const articleStyles = ['NATURAL_EDITORIAL', 'NEWS_FEATURE', 'PRACTICAL_GUIDE'] as const;
export const generateArticleSchema = z.object({
  topic: z.string().min(3).max(300),
  audience: z.string().max(300).optional(),
  style: z.enum(articleStyles).default('NATURAL_EDITORIAL'),
});
export const generateSocialSchema = z.object({ topic: z.string().min(3).max(300) });

export type BusinessInput = z.infer<typeof businessSchema>;
export type ContentInput = z.infer<typeof contentSchema>;
