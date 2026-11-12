import { describe, expect, it } from 'vitest';
import { stagingExecutionUrl, validateStagingTarget } from '../src/services/staging-target.js';

describe('staging target safety', () => {
  it('allows localhost during development', () => {
    expect(validateStagingTarget('https://www.example.com', 'http://localhost/wordpress', 'development')).toEqual({
      url: 'http://localhost/wordpress', isLocal: true,
    });
  });
  it('rejects the live hostname even when the scheme differs', () => {
    expect(() => validateStagingTarget('https://www.example.com', 'http://example.com/test', 'development')).toThrow(/live website hostname/);
  });
  it('rejects localhost in production', () => {
    expect(() => validateStagingTarget('https://example.com', 'http://127.0.0.1/site', 'production')).toThrow(/disabled in production/);
  });
  it('maps a live page path and query onto the staging base path', () => {
    expect(stagingExecutionUrl('https://example.com/about/?preview=1', 'http://localhost/wordpress')).toBe('http://localhost/wordpress/about/?preview=1');
  });
});
