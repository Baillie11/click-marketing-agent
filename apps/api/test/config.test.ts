import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  DATABASE_URL: 'mysql://user:pass@localhost:3306/test',
  JWT_SECRET: 'a-unique-secret-that-is-at-least-32-characters',
};

describe('environment configuration', () => {
  it('keeps SMTP optional for local development', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'development' });
    expect(config.SMTP_HOST).toBeUndefined();
    expect(config.APP_URL).toBe('http://localhost:5173');
  });

  it('requires password-recovery email settings in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow();
    expect(loadConfig({
      ...base,
      NODE_ENV: 'production',
      APP_URL: 'https://marketing.example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'no-reply@example.com',
    }).SMTP_HOST).toBe('smtp.example.com');
  });
});
