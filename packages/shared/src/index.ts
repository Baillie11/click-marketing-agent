import { z } from 'zod';

export * from './version.js';

export const contentStatuses = ['IDEA', 'DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED'] as const;
export const contentTypes = ['SEO_ARTICLE', 'WEBSITE_REWRITE', 'FACEBOOK_POST', 'LINKEDIN_POST', 'REDDIT_RESPONSE', 'CAMPAIGN_IDEA', 'EMAIL_NEWSLETTER', 'SOCIAL_POST', 'LEAD_REPLY'] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});
export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z.string().min(10).max(128),
  confirmPassword: z.string().min(1),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: 'New passwords do not match',
  path: ['confirmPassword'],
});
export const createWorkspaceUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(['MANAGER', 'EDITOR', 'VIEWER']).default('EDITOR'),
});
export const accountProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  currentPassword: z.string().min(1),
});
export const accountPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(128),
  confirmPassword: z.string().min(1),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: 'New passwords do not match',
  path: ['confirmPassword'],
}).refine((value) => value.newPassword !== value.currentPassword, {
  message: 'Choose a password different from your current password',
  path: ['newPassword'],
});
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

export const leadPlatforms = ['REDDIT', 'FACEBOOK', 'LINKEDIN', 'THREADS', 'INSTAGRAM', 'AIRTASKER', 'FORUM', 'OTHER'] as const;
export const captureLeadSchema = z.object({
  platform: z.enum(leadPlatforms),
  originalUrl: z.string().url().max(2048),
  postText: z.string().trim().min(10).max(50000),
  communityName: z.string().trim().max(255).optional(),
  authorDisplayName: z.string().trim().max(255).optional(),
  postedAt: z.string().datetime().optional(),
});
export const createLeadReplySchema = z.object({
  body: z.string().trim().min(1).max(10000),
  postingIdentity: z.string().trim().min(2).max(255),
});
export const updateLeadReplySchema = createLeadReplySchema.extend({ expectedVersion: z.number().int().positive() });
export const leadDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  revisionId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.decision === 'REJECTED' && !value.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A reason is required when rejecting a reply' });
});
export const manualPublicationSchema = z.object({
  actualText: z.string().trim().min(1).max(10000),
  postingIdentity: z.string().trim().min(2).max(255),
  publishedAt: z.string().datetime(),
  responseUrl: z.string().url().max(2048).optional(),
  evidenceNote: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(8).max(100),
});
export const outreachPolicySchema = z.object({
  speakerName: z.string().trim().max(100).default(''),
  speakerRole: z.string().trim().max(150).default(''),
  allowBusinessName: z.boolean().default(true),
  allowPublicLinks: z.boolean().default(false),
  allowedUrls: z.array(z.string().url()).max(20).default([]),
  approvedClaims: z.array(z.string().min(1).max(500)).max(50).default([]),
  ctaStyle: z.string().trim().max(1000).default('Helpful and low pressure'),
  excludedTopics: z.array(z.string().min(1).max(200)).max(50).default([]),
  maxReplyLength: z.number().int().min(100).max(5000).default(1200),
});

export type BusinessInput = z.infer<typeof businessSchema>;
export type ContentInput = z.infer<typeof contentSchema>;
