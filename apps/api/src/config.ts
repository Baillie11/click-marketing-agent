import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  LEAD_DISCOVERY_CRON_SECRET: z.string().min(32).optional(),
  CONNECTOR_ENCRYPTION_KEY: z.string().optional(),
  CRAWLER_MAX_PAGES: z.coerce.number().int().min(1).max(100).default(50),
  CRAWLER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  VISUAL_AUDIT_MAX_PAGES: z.coerce.number().int().min(2).max(20).default(10),
  BROWSER_EXECUTABLE_PATH: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:5173'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: booleanString,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().int().min(10).max(1440).default(60),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production') {
    if (!value.SMTP_HOST) context.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST is required in production' });
    if (!value.SMTP_FROM) context.addIssue({ code: 'custom', path: ['SMTP_FROM'], message: 'SMTP_FROM is required in production' });
    if (value.JWT_SECRET.includes('replace-with')) context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Use a unique JWT_SECRET in production' });
  }
});
export type Config = z.infer<typeof schema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => schema.parse(env);
