import bcrypt from 'bcryptjs';

// Ten rounds keeps account creation responsive on constrained shared-hosting
// Passenger workers while retaining bcrypt's adaptive password protection.
const BCRYPT_ROUNDS = 10;

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
