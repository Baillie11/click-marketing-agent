import { describe, expect, it } from 'vitest';
import { decryptConnectorSecret, encryptConnectorSecret } from '../src/services/connector-secret.js';

describe('connector credential encryption', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  it('round trips without storing plaintext', () => {
    const encrypted = encryptConnectorSecret('abcd efgh ijkl', key);
    expect(encrypted).not.toContain('abcd');
    expect(decryptConnectorSecret(encrypted, key)).toBe('abcd efgh ijkl');
  });
  it('rejects an invalid key', () => {
    expect(() => encryptConnectorSecret('secret', 'bad')).toThrow(/32-byte/);
  });
});
