import { execSync } from 'node:child_process';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { SentinelConfig, RouteConfig } from './types.js';
import * as logger from '../utils/logger.js';

let activeBrowser: Browser | null = null;

function registerCleanup() {
  const cleanup = async () => {
    if (activeBrowser) {
      await activeBrowser.close().catch(() => {});
      activeBrowser = null;
    }
  };
  process.on('SIGINT', () => { cleanup().then(() => process.exit(130)); });
  process.on('SIGTERM', () => { cleanup().then(() => process.exit(143)); });
}

export async function launchBrowser(): Promise<Browser> {
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    logger.info('Chromium not found — installing automatically...');
    try {
      execSync('npx playwright install chromium', { stdio: 'pipe' });
    } catch {
      throw new Error(
        'Failed to auto-install Chromium. Run manually: npx playwright install chromium',
      );
    }
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      const hint = (err as Error).message?.includes('Executable')
        ? 'Run manually: npx playwright install chromium'
        : 'Chromium installed but failed to launch. You may be missing system dependencies — see https://playwright.dev/docs/intro#system-requirements';
      throw new Error(hint);
    }
  }
  activeBrowser = browser;
  registerCleanup();
  return browser;
}

export async function createContext(
  browser: Browser,
  config: SentinelConfig,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  if (config.auth) {
    if (config.auth.type === 'cookie') {
      const url = new URL(config.baseUrl);
      await context.addCookies([{
        name: config.auth.name,
        value: config.auth.value,
        domain: url.hostname,
        path: '/',
      }]);
    }
  }

  return context;
}

export async function navigateToRoute(
  page: Page,
  baseUrl: string,
  route: RouteConfig,
): Promise<void> {
  const url = new URL(route.path, baseUrl).href;
  logger.debug(`Navigating to ${url}`);
  const waitUntil = route.waitFor ?? 'domcontentloaded';
  await page.goto(url, { waitUntil, timeout: 30_000 });
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close().catch(() => {});
  if (activeBrowser === browser) activeBrowser = null;
}
