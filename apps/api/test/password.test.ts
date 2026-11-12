import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/services/password.js';

describe('password service', () => {
  it('creates and verifies bcrypt password hashes', async () => {
    const hash = await hashPassword('A secure test password');

    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    await expect(verifyPassword(hash, 'A secure test password')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'incorrect password')).resolves.toBe(false);
  });
});
