import { db } from '../db.js';
import { decryptConnectorSecret } from './connector-secret.js';
import { WordPressPublisher } from './wordpress-connector.js';

export type WebsiteField = 'SEO_TITLE' | 'META_DESCRIPTION' | 'H1' | 'H2' | 'ALT_TEXT' | 'CONTENT' | 'INTERNAL_LINK';

export type ApplyWebsiteChange = {
  targetUrl: string;
  field: WebsiteField;
  expectedCurrentValue: string | null;
  proposedValue: string;
};

export type ApplyWebsiteChangeResult = {
  appliedValue: string;
  platformRevisionId?: string;
};

export interface WebsitePublisher {
  readonly provider: 'WORDPRESS' | 'SHOPIFY' | 'CUSTOM';
  verifyConnection(): Promise<void>;
  readField(targetUrl: string, field: WebsiteField): Promise<string | null>;
  apply(change: ApplyWebsiteChange): Promise<ApplyWebsiteChangeResult>;
  revert?(platformRevisionId: string): Promise<void>;
}

export const getPublisher = async (
  websiteId: string,
  encryptionKey?: string,
): Promise<WebsitePublisher | null> => {
  if (!encryptionKey) return null;
  const website = await db.website.findUnique({ where: { id: websiteId } });
  if (
    !website ||
    website.connectionStatus !== 'CONNECTED' ||
    !website.connectionSecret ||
    !website.connectionUsername
  ) {
    return null;
  }
  if (website.connectionProvider === 'WORDPRESS') {
    try {
      const applicationPassword = decryptConnectorSecret(website.connectionSecret, encryptionKey);
      const targetBaseUrl = website.connectionBaseUrl ?? website.baseUrl;
      const allowLocalDevelopment = website.connectionTarget === 'STAGING' && process.env.NODE_ENV !== 'production';
      return new WordPressPublisher(targetBaseUrl, website.connectionUsername, applicationPassword, allowLocalDevelopment);
    } catch {
      return null;
    }
  }
  return null;
};
