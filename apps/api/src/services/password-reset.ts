import { createHash, randomBytes } from 'node:crypto';

export const createPasswordResetToken = () => {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashPasswordResetToken(token) };
};

export const hashPasswordResetToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export const passwordResetExpiry = (minutes: number, now = new Date()) =>
  new Date(now.getTime() + minutes * 60_000);
