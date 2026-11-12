import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const keyFrom = (encodedKey: string) => {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) throw new Error('CONNECTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
};

export const encryptConnectorSecret = (value: string, encodedKey: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(encodedKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

export const decryptConnectorSecret = (payload: string, encodedKey: string) => {
  const [version, iv, tag, encrypted] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid encrypted connector credential');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(encodedKey), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};
