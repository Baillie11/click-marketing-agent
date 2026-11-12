import { assertSafePublicUrl } from '../lib/url.js';
import type { ApplyWebsiteChange, ApplyWebsiteChangeResult, WebsiteField, WebsitePublisher } from './publishers.js';

type WordPressCredentials = {
  baseUrl: string;
  username: string;
  applicationPassword: string;
  allowLocalDevelopment?: boolean;
};

const endpoint = (baseUrl: string, path: string) => new URL(path, `${baseUrl.replace(/\/+$/, '')}/`).toString();

// Matches real HTML tags (e.g. <h2>, <p class="x">), not stray ampersands or angle brackets in copy.
const HTML_TAG = /<[a-zA-Z][^>]*>/;

// Strip tags and collapse whitespace so we can tell whether a value is plain text.
const toPlainText = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Title / excerpt fields must receive short, plain-text values only.
const isSafePlainText = (value: string, maxLength: number) =>
  !HTML_TAG.test(value) && toPlainText(value).length <= maxLength;

const assertConnectorUrl = async (baseUrl: string, allowLocalDevelopment = false) => {
  const url = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase());
  if (allowLocalDevelopment && local && url.protocol === 'http:') return url;
  return assertSafePublicUrl(baseUrl);
};

export const verifyWordPressConnection = async ({ baseUrl, username, applicationPassword, allowLocalDevelopment }: WordPressCredentials) => {
  await assertConnectorUrl(baseUrl, allowLocalDevelopment);
  const response = await fetch(endpoint(baseUrl, 'wp-json/wp/v2/users/me?context=edit'), {
    headers: { Authorization: `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString('base64')}` },
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 401)
    throw new Error('WordPress could not authenticate that Application Password. Use the exact Username shown in Users → Profile (not the display name and preferably not the email address), then generate and copy a fresh Application Password. Do not use your normal WordPress password. If those are correct, a security plugin or hosting rule may be removing the Authorization header.');
  if (response.status === 403)
    throw new Error('WordPress received the connection but refused access. Confirm the WordPress user has permission to edit pages and check whether a security plugin, firewall, or hosting rule blocks REST API Application Password authentication.');
  if (!response.ok)
    throw new Error(`WordPress REST API verification failed (HTTP ${response.status})`);
  const user = await response.json() as { id?: number; name?: string };
  if (!user.id) throw new Error('WordPress returned an invalid verification response');
  return { userId: user.id, displayName: user.name ?? username };
};

export class WordPressPublisher implements WebsitePublisher {
  readonly provider = 'WORDPRESS' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly applicationPassword: string,
    private readonly allowLocalDevelopment = false,
  ) {}

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`;
  }

  async verifyConnection(): Promise<void> {
    await verifyWordPressConnection({
      baseUrl: this.baseUrl,
      username: this.username,
      applicationPassword: this.applicationPassword,
      allowLocalDevelopment: this.allowLocalDevelopment,
    });
  }

  async readField(targetUrl: string, field: WebsiteField): Promise<string | null> {
    const resource = await this.findResource(targetUrl);
    if (!resource) return null;
    if (field === 'SEO_TITLE') return resource.title?.rendered ?? resource.title?.raw ?? null;
    if (field === 'H1') {
      const content = resource.content?.raw ?? resource.content?.rendered ?? '';
      const match = content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      return match ? toPlainText(match[1]) : null;
    }
    if (field === 'META_DESCRIPTION') return resource.excerpt?.rendered ?? resource.excerpt?.raw ?? null;
    if (field === 'CONTENT') return resource.content?.rendered ?? resource.content?.raw ?? null;
    return null;
  }

  async apply(change: ApplyWebsiteChange): Promise<ApplyWebsiteChangeResult> {
    const resource = await this.findResource(change.targetUrl);
    if (!resource) {
      throw new Error(`Could not find matching WordPress page or post for URL: ${change.targetUrl}`);
    }

    if (change.expectedCurrentValue !== null) {
      const currentValue = await this.readField(change.targetUrl, change.field);
      const expected = toPlainText(change.expectedCurrentValue);
      const current = toPlainText(currentValue ?? '');
      if (expected !== current) {
        throw new Error('The staging field changed after this proposal was prepared. Refresh the recommendation before applying it.');
      }
    }

    const endpointUrl = endpoint(this.baseUrl, `wp-json/wp/v2/${resource.type}/${resource.id}`);
    const fieldUpper = change.field.toUpperCase();
    const body: Record<string, unknown> = {};
    const value = change.proposedValue;

    // Refuse to write markup or over-long text into plain-text fields.
    if (fieldUpper === 'SEO_TITLE' || (fieldUpper.includes('TITLE') && fieldUpper !== 'H1')) {
      if (!isSafePlainText(value, 120))
        throw new Error('Refusing to apply SEO title: value contains HTML or exceeds 120 characters');
      body.title = toPlainText(value);
      body.meta = {
        _yoast_wpseo_title: toPlainText(value),
        rank_math_title: toPlainText(value),
        _aioseo_title: toPlainText(value),
      };
    } else if (fieldUpper === 'META_DESCRIPTION' || fieldUpper.includes('DESCRIPTION')) {
      if (!isSafePlainText(value, 200))
        throw new Error('Refusing to apply meta description: value contains HTML or exceeds 200 characters');
      body.excerpt = toPlainText(value);
      body.meta = {
        _yoast_wpseo_metadesc: toPlainText(value),
        rank_math_description: toPlainText(value),
        _aioseo_description: toPlainText(value),
      };
    } else if (fieldUpper === 'H1') {
      // An on-page H1 lives in the rendered content, not the title field. Prepend a
      // single clean H1 to the existing content so we never clobber the body or title.
      if (HTML_TAG.test(value))
        throw new Error('Refusing to apply H1: value must be plain heading text, not markup');
      const heading = toPlainText(value);
      if (!heading || heading.length > 120)
        throw new Error('Refusing to apply H1: value is empty or exceeds 120 characters');
      const existing = resource.content?.raw ?? resource.content?.rendered ?? '';
      body.content = `<h1>${heading}</h1>\n${existing}`;
    } else if (fieldUpper === 'CONTENT') {
      // CONTENT may legitimately contain HTML, but never allow it to empty the page.
      if (!value.trim()) throw new Error('Refusing to apply empty page content');
      body.content = value;
    } else {
      // H2, ALT_TEXT, INTERNAL_LINK and anything else are not safely applicable via
      // the WordPress REST title/excerpt/content fields — refuse rather than corrupt.
      throw new Error(`Auto-fix does not support applying the "${change.field}" field to WordPress`);
    }

    let response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    // If WordPress rejects the custom meta fields, fallback to updating core fields only
    if (!response.ok && body.meta) {
      delete body.meta;
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `HTTP ${response.status}`;
      try {
        const json = JSON.parse(errorText);
        if (json.message) errorMsg = json.message;
      } catch {
        // Retain the HTTP status when WordPress returns a non-JSON error page.
      }
      throw new Error(`Failed to update WordPress page #${resource.id}: ${errorMsg}`);
    }

    const updated = (await response.json()) as { id: number };

    // Best-effort cache purge across common WordPress caching plugins
    await this.purgeCache().catch(() => {});

    return {
      appliedValue: change.proposedValue,
      platformRevisionId: String(updated.id),
    };
  }

  async purgeCache(): Promise<void> {
    const purgeEndpoints = [
      'wp-json/litespeed/v1/purge_all',
      'wp-json/wp-optimize/v1/cache/purge',
      'wp-json/wp-rocket/v1/purge',
    ];
    for (const ep of purgeEndpoints) {
      try {
        await fetch(endpoint(this.baseUrl, ep), {
          method: 'POST',
          headers: { Authorization: this.authHeader },
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        // Cache integrations are optional and must never make a verified content write fail.
      }
    }
  }

  private async findResource(targetUrl: string): Promise<{ id: number; type: 'pages' | 'posts'; title?: any; excerpt?: any; content?: any; link?: string } | null> {
    const urlObj = new URL(targetUrl);
    const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, '');
    const headers = { Authorization: this.authHeader };

    if (!pathname) {
      const res = await fetch(endpoint(this.baseUrl, 'wp-json/wp/v2/pages?per_page=20&context=edit'), { headers, signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const pages = (await res.json()) as any[];
        const match = pages.find((p) => {
          if (!p.link) return false;
          const pPath = new URL(p.link).pathname.replace(/^\/+|\/+$/g, '');
          return !pPath || p.slug === 'home' || p.slug === 'front-page';
        }) ?? pages[0];
        if (match) return { id: match.id, type: 'pages', title: match.title, excerpt: match.excerpt, content: match.content, link: match.link };
      }
    }

    const slug = pathname.split('/').pop() || pathname;
    const pageRes = await fetch(endpoint(this.baseUrl, `wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit`), { headers, signal: AbortSignal.timeout(10_000) });
    if (pageRes.ok) {
      const pages = (await pageRes.json()) as any[];
      if (pages.length > 0) {
        const p = pages[0];
        return { id: p.id, type: 'pages', title: p.title, excerpt: p.excerpt, content: p.content, link: p.link };
      }
    }

    const postRes = await fetch(endpoint(this.baseUrl, `wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit`), { headers, signal: AbortSignal.timeout(10_000) });
    if (postRes.ok) {
      const posts = (await postRes.json()) as any[];
      if (posts.length > 0) {
        const p = posts[0];
        return { id: p.id, type: 'posts', title: p.title, excerpt: p.excerpt, content: p.content, link: p.link };
      }
    }

    const searchRes = await fetch(endpoint(this.baseUrl, `wp-json/wp/v2/pages?search=${encodeURIComponent(slug)}&context=edit`), { headers, signal: AbortSignal.timeout(10_000) });
    if (searchRes.ok) {
      const pages = (await searchRes.json()) as any[];
      const match = pages.find((p) => p.link && new URL(p.link).pathname.replace(/^\/+|\/+$/g, '') === pathname) ?? pages[0];
      if (match) return { id: match.id, type: 'pages', title: match.title, excerpt: match.excerpt, content: match.content, link: match.link };
    }

    return null;
  }
}
