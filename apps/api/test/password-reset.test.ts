import { describe, expect, it } from 'vitest';
import { createPasswordResetToken, hashPasswordResetToken, passwordResetExpiry } from '../src/services/password-reset.js';

describe('password reset tokens', () => {
  it('creates opaque tokens and stores only a deterministic hash', () => {
    const first = createPasswordResetToken();
    const second = createPasswordResetToken();
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashPasswordResetToken(first.token));
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).not.toContain(first.token);
  });

  it('calculates a bounded expiry', () => {
    const now = new Date('2026-10-20T00:00:00.000Z');
    expect(passwordResetExpiry(60, now).toISOString()).toBe('2026-10-20T01:00:00.000Z');
  });
});
