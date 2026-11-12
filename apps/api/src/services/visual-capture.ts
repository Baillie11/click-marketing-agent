import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { assertSafePublicUrl } from '../lib/url.js';

export type VisualCapture = {
  url: string;
  viewport: 'desktop' | 'mobile';
  imageBase64: string;
};

const browserPath = (configured?: string) => {
  const candidates = [
    configured,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean) as string[];
  const found = candidates.find(existsSync);
  if (!found) throw new Error('No supported Chrome or Edge browser was found for visual auditing');
  return found;
};

const priority = (url: string) => {
  const path = new URL(url).pathname.toLowerCase();
  if (path === '/' || path === '') return 0;
  if (/about/.test(path)) return 1;
  if (/contact/.test(path)) return 2;
  return 3;
};

export const selectVisualAuditUrls = (urls: string[], limit: number) =>
  [...new Set(urls)].sort((a, b) => priority(a) - priority(b)).slice(0, limit);

export const captureWebsiteLayouts = async (
  urls: string[],
  executablePath: string | undefined,
): Promise<VisualCapture[]> => {
  for (const url of urls) await assertSafePublicUrl(url);
  const browser = await chromium.launch({ executablePath: browserPath(executablePath), headless: true });
  const captures: VisualCapture[] = [];
  try {
    for (const url of urls) {
      for (const viewport of [
        { name: 'desktop' as const, width: 1365, height: 900, isMobile: false },
        { name: 'mobile' as const, width: 390, height: 844, isMobile: true },
      ]) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          isMobile: viewport.isMobile,
          deviceScaleFactor: 1,
          colorScheme: 'light',
        });
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});
          await page.waitForTimeout(1000);
          await page.evaluate(() => {
            document.querySelectorAll('video').forEach((video) => video.pause());
            document.querySelectorAll<HTMLElement>('*').forEach((element) => {
              element.style.setProperty('animation-duration', '0s', 'important');
              element.style.setProperty('transition-duration', '0s', 'important');
            });
          });
          const image = await page.screenshot({ type: 'jpeg', quality: 58, fullPage: true });
          captures.push({ url, viewport: viewport.name, imageBase64: image.toString('base64') });
        } finally {
          await context.close();
        }
      }
    }
    return captures;
  } finally {
    await browser.close();
  }
};
