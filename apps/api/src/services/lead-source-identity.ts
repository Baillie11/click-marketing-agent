import { createHash } from 'node:crypto';

const TRACKING_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']);

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const canonicalLeadUrl = (rawUrl: string) => {
  const url = new URL(rawUrl);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.hostname === 'old.reddit.com' || url.hostname === 'np.reddit.com') url.hostname = 'reddit.com';
  for (const key of [...url.searchParams.keys()]) if (TRACKING_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
};

export const leadSourceIdentity = (platform: string, rawUrl: string) => {
  const canonicalUrl = canonicalLeadUrl(rawUrl);
  return { canonicalUrl, sourceKeyHash: sha256(`${platform.toUpperCase()}:${canonicalUrl}`) };
};
