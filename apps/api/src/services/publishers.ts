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

// Provider implementations are intentionally registered only after their OAuth/application-token
// flow and field mapping have been verified. This prevents a configured toggle from pretending that
// a live website was changed when no safe publishing adapter exists.
export const getPublisher = (websiteId: string): WebsitePublisher | null => {
  void websiteId;
  return null;
};
