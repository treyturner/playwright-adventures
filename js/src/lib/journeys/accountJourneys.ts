import { expect, Page } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { TestUser } from '../fixtures/testUsers';

export interface JourneyResult {
  journeyId: string;
  success: boolean;
  details?: string;
}

export const viewAccountDetailsJourney = async (page: Page, user: TestUser): Promise<JourneyResult> => {
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);

  await homePage.goto();
  await homePage.openLogin();

  await loginPage.fillForm(user);
  await loginPage.submit();

  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
  await page.getByTestId('account-list-item').first().click();
  await expect(page.getByRole('heading', { level: 1, name: /account details/i })).toBeVisible();
  await expect(page.getByTestId('transaction-table')).toBeVisible();

  return { journeyId: 'view-account-details', success: true, details: 'Account details rendered' };
};

export const loginAndViewDashboardJourney = async (page: Page, user: TestUser): Promise<JourneyResult> => {
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);

  await homePage.goto();
  await homePage.openLogin();

  await loginPage.fillForm(user);
  await loginPage.submit();

  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
  await expect(page.getByTestId('account-summary')).toBeVisible();

  return { journeyId: 'login-and-view-dashboard', success: true, details: 'Dashboard rendered' };
};

export const journeys = {
  'view-account-details': viewAccountDetailsJourney,
  'login-and-view-dashboard': loginAndViewDashboardJourney
};
