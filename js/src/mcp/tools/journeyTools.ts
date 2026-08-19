import { Page } from '@playwright/test';
import { demoUser, TestUser } from '../../lib/fixtures/testUsers.js';
import { journeys, JourneyResult } from '../../lib/journeys/accountJourneys.js';
import { BrowserController } from './browserTools.js';

export interface JourneyToolParams {
  journeyId: string;
  user?: TestUser;
}

export interface JourneyToolResult extends JourneyResult {}

export interface JourneyTools {
  runJourney(params: JourneyToolParams): Promise<JourneyToolResult>;
}

const resolveJourney = (journeyId: string): ((page: Page, user: TestUser) => Promise<JourneyResult>) => {
  const journey = journeys[journeyId as keyof typeof journeys];
  if (!journey) {
    throw new Error(`Unknown journey: ${journeyId}`);
  }
  return journey;
};

export const createJourneyTools = (controller: BrowserController): JourneyTools => {
  return {
    runJourney: async ({ journeyId, user }: JourneyToolParams): Promise<JourneyToolResult> => {
      const page = await controller.getPage();
      const journey = resolveJourney(journeyId);
      const activeUser = user ?? demoUser;
      const result = await journey(page, activeUser);
      return result;
    }
  };
};
