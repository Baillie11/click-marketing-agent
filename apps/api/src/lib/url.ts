import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const blocked = (address: string) => {
  if (!isIP(address)) return true;
  const parts = address.split('.').map(Number);
  if (isIP(address) === 4)
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && (parts[1] ?? 0) >= 64 && (parts[1] ?? 0) <= 127)
    );
  const lower = address.toLowerCase();
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  );
};

export const normaliseUrl = (raw: string, base?: string) => {
  const url = new URL(raw, base);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  )
    url.port = '';
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
};

export const sameDomain = (a: string, b: string) => {
  const clean = (host: string) => host.toLowerCase().replace(/^www\./, '');
  return clean(new URL(a).hostname) === clean(new URL(b).hostname);
};

export const assertSafePublicUrl = async (raw: string) => {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Only public HTTP(S) URLs are allowed');
  if (['localhost', 'localhost.localdomain'].includes(url.hostname.toLowerCase()))
    throw new Error('Private network targets are not allowed');
  const results = await lookup(url.hostname, { all: true });
  if (!results.length || results.some(({ address }) => blocked(address)))
    throw new Error('Private network targets are not allowed');
  return url;
};
