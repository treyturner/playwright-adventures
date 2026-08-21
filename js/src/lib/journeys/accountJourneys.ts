import { Page } from '@playwright/test';
import { TestUser } from '../fixtures/testUsers.js';
import { JourneyId, journeyIds, journeySpecs } from './generatedJourneySpecs.js';
import { executeJourney } from './journeyRunner.js';

export interface JourneyResult {
  journeyId: string;
  success: boolean;
  details?: string;
}

export type Journey = (page: Page, user: TestUser) => Promise<JourneyResult>;

export const runJourney = async (page: Page, user: TestUser, journeyId: JourneyId): Promise<JourneyResult> => {
  await executeJourney(page, user, journeyId);
  return { journeyId, success: true, details: journeySpecs[journeyId].successMessage };
};

export const loginAndViewDashboardJourney = async (page: Page, user: TestUser): Promise<JourneyResult> => {
  return runJourney(page, user, 'login-and-view-dashboard');
};

export const viewAccountDetailsJourney = async (page: Page, user: TestUser): Promise<JourneyResult> => {
  return runJourney(page, user, 'view-account-details');
};

export const journeys = Object.fromEntries(
  journeyIds.map((journeyId) => [journeyId, (page: Page, user: TestUser) => runJourney(page, user, journeyId)])
) as Record<JourneyId, Journey>;
