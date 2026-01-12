import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface BrowserActionResult {
  success: boolean;
  message: string;
  url?: string;
  value?: string;
  screenshotPath?: string;
}

export interface NavigateParams { url: string; }
export interface ClickParams { selector: string; }
export interface FillParams { selector: string; value: string; }
export interface GetTextParams { selector: string; }
export interface ScreenshotParams { path?: string; }

export class BrowserController {
  private browser?: Browser;
  private page?: Page;
  private readonly baseURL: string;

  constructor(baseURL: string = process.env.BASE_URL || 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async getPage(): Promise<Page> {
    if (this.page) return this.page;

    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext({ baseURL: this.baseURL });
    this.page = await context.newPage();
    return this.page;
  }

  async dispose(): Promise<void> {
    await this.page?.context().close();
    await this.browser?.close();
    this.page = undefined;
    this.browser = undefined;
  }
}

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const createBrowserTools = (controller: BrowserController) => {
  return {
    navigate: async ({ url }: NavigateParams): Promise<BrowserActionResult> => {
      const page = await controller.getPage();
      await page.goto(url);
      return { success: true, message: 'Navigated', url: page.url() };
    },
    click: async ({ selector }: ClickParams): Promise<BrowserActionResult> => {
      const page = await controller.getPage();
      await page.click(selector);
      return { success: true, message: `Clicked ${selector}`, url: page.url() };
    },
    fill: async ({ selector, value }: FillParams): Promise<BrowserActionResult> => {
      const page = await controller.getPage();
      await page.fill(selector, value);
      return { success: true, message: `Filled ${selector}` };
    },
    getText: async ({ selector }: GetTextParams): Promise<BrowserActionResult> => {
      const page = await controller.getPage();
      const content = await page.textContent(selector);
      return { success: true, message: 'Text retrieved', value: content ?? '' };
    },
    screenshot: async ({ path: screenshotPath }: ScreenshotParams): Promise<BrowserActionResult> => {
      const page = await controller.getPage();
      const outputDir = path.join(process.cwd(), 'screenshots');
      ensureDir(outputDir);
      const resolvedPath = screenshotPath || path.join(outputDir, `shot-${Date.now()}.png`);
      await page.screenshot({ path: resolvedPath, fullPage: true });
      return { success: true, message: 'Screenshot captured', screenshotPath: resolvedPath };
    }
  };
};
