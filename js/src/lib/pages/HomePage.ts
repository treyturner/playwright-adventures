import { expect, Page } from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async expectHeroHeading(text: RegExp | string): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 1, name: text })).toBeVisible();
  }

  async openLogin(): Promise<void> {
    await this.page.getByRole('link', { name: /sign in|log in/i }).click();
  }
}
