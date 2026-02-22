import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page } from 'playwright';

export async function captureClean(page: Page, savePath: string): Promise<Buffer> {
  mkdirSync(dirname(savePath), { recursive: true });
  const buffer = await page.screenshot({ fullPage: false, path: savePath });
  return buffer;
}

export async function captureAnnotated(
  page: Page,
  selectors: string[],
  savePath: string,
): Promise<Buffer> {
  if (selectors.length === 0) {
    return captureClean(page, savePath);
  }

  mkdirSync(dirname(savePath), { recursive: true });

  const cssContent = selectors
    .map(
      (s) =>
        `${s} { outline: 3px solid #e53e3e !important; background-color: rgba(229,62,62,0.08) !important; }`,
    )
    .join('\n');

  const styleTag = await page.addStyleTag({ content: cssContent });
  const buffer = await page.screenshot({ fullPage: false, path: savePath });
  await styleTag.evaluate((el) => el.parentNode?.removeChild(el));

  return buffer;
}
