import { expect, Page } from '@playwright/test';
import { TestUser } from '../fixtures/testUsers';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.page.getByRole('heading', { level: 1, name: /sign in|log in/i })).toBeVisible();
  }

  async fillForm(user: TestUser): Promise<void> {
    await this.page.getByLabel(/email/i).fill(user.email);
    await this.page.getByLabel(/password/i).fill(user.password);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: /sign in|log in/i }).click();
  }
}
