import { chromium, type Browser, type BrowserContext, type Frame, type Page, type Route } from 'playwright';

import {
  createBrowserSecurityPolicy,
  type BrowserSecurityPolicy,
  resolveScreenshotPath,
  validateNavigationUrl
} from '../security.js';

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

export interface BrowserTools {
  navigate(params: NavigateParams): Promise<BrowserActionResult>;
  click(params: ClickParams): Promise<BrowserActionResult>;
  fill(params: FillParams): Promise<BrowserActionResult>;
  getText(params: GetTextParams): Promise<BrowserActionResult>;
  screenshot(params: ScreenshotParams): Promise<BrowserActionResult>;
}

export class BrowserController {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private pagePromise?: Promise<Page>;
  private bootstrapPage?: Page;
  private documentViolation?: Error;
  readonly policy: BrowserSecurityPolicy;

  constructor(policy: BrowserSecurityPolicy = createBrowserSecurityPolicy()) {
    this.policy = policy;
  }

  async getPage(): Promise<Page> {
    this.assertDocumentNavigationsAllowed();
    if (this.page) return this.page;
    this.pagePromise ??= this.createPage();

    try {
      this.page = await this.pagePromise;
      this.assertDocumentNavigationsAllowed();
      return this.page;
    } finally {
      this.pagePromise = undefined;
    }
  }

  validateNavigation(url: string): string {
    return validateNavigationUrl(url, this.policy.allowedOrigins);
  }

  resolveScreenshotPath(filename?: string): string {
    return resolveScreenshotPath(this.policy, filename);
  }

  assertDocumentNavigationsAllowed(): void {
    if (this.documentViolation) {
      throw this.documentViolation;
    }
  }

  private async createPage(): Promise<Page> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      acceptDownloads: false,
      baseURL: this.policy.baseURL,
      serviceWorkers: 'block'
    });
    await this.context.route('**/*', (route) => this.guardNavigation(route));
    const page = await this.context.newPage();
    this.bootstrapPage = page;
    this.context.on('framenavigated', (frame) => this.guardDocumentNavigation(frame));
    return page;
  }

  private async guardNavigation(route: Route): Promise<void> {
    const request = route.request();
    if (request.isNavigationRequest()) {
      try {
        validateNavigationUrl(request.url(), this.policy.allowedOrigins);
      } catch {
        await route.abort('blockedbyclient');
        return;
      }
    }
    await route.continue();
  }

  private guardDocumentNavigation(frame: Frame): void {
    if (frame.page() === this.bootstrapPage && frame === this.bootstrapPage.mainFrame()) {
      if (frame.url() === 'about:blank') return;
      this.bootstrapPage = undefined;
    }

    try {
      validateNavigationUrl(frame.url(), this.policy.allowedOrigins);
    } catch {
      this.documentViolation ??= new Error(`Document navigation blocked: ${frame.url()} is not allowed`);
      void frame.page().close().catch(() => undefined);
    }
  }

  async dispose(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = undefined;
    this.page = undefined;
    this.pagePromise = undefined;
    this.bootstrapPage = undefined;
    this.browser = undefined;
    this.documentViolation = undefined;
  }
}

const requireNonEmpty = (value: string, label: string): void => {
  if (!value.trim()) {
    throw new Error(`${label} must not be empty`);
  }
};

export const createBrowserTools = (controller: BrowserController): BrowserTools => {
  return {
    navigate: async ({ url }: NavigateParams): Promise<BrowserActionResult> => {
      const validatedUrl = controller.validateNavigation(url);
      const page = await controller.getPage();
      await page.goto(validatedUrl);
      controller.assertDocumentNavigationsAllowed();
      return { success: true, message: 'Navigated', url: page.url() };
    },
    click: async ({ selector }: ClickParams): Promise<BrowserActionResult> => {
      requireNonEmpty(selector, 'Selector');
      const page = await controller.getPage();
      await page.click(selector);
      controller.assertDocumentNavigationsAllowed();
      return { success: true, message: `Clicked ${selector}`, url: page.url() };
    },
    fill: async ({ selector, value }: FillParams): Promise<BrowserActionResult> => {
      requireNonEmpty(selector, 'Selector');
      const page = await controller.getPage();
      await page.fill(selector, value);
      controller.assertDocumentNavigationsAllowed();
      return { success: true, message: `Filled ${selector}` };
    },
    getText: async ({ selector }: GetTextParams): Promise<BrowserActionResult> => {
      requireNonEmpty(selector, 'Selector');
      const page = await controller.getPage();
      const content = await page.textContent(selector);
      controller.assertDocumentNavigationsAllowed();
      return { success: true, message: 'Text retrieved', value: content ?? '' };
    },
    screenshot: async ({ path: screenshotPath }: ScreenshotParams): Promise<BrowserActionResult> => {
      const resolvedPath = controller.resolveScreenshotPath(screenshotPath);
      const page = await controller.getPage();
      await page.screenshot({ path: resolvedPath, fullPage: true });
      controller.assertDocumentNavigationsAllowed();
      return { success: true, message: 'Screenshot captured', screenshotPath: resolvedPath };
    }
  };
};
