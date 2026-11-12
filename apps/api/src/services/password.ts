import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = async (hash: string, password: string) => {
  if (hash.startsWith('$2')) return bcrypt.compare(password, hash);

  if (hash.startsWith('$argon2')) {
    try {
      const argon2 = await import('argon2');
      return argon2.default.verify(hash, password);
    } catch {
      return false;
    }
  }

  return false;
};
