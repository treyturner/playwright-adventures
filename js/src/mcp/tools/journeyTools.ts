import { Page } from '@playwright/test';
import { demoUser, TestUser } from '../../lib/fixtures/testUsers.js';
import { journeys, JourneyResult } from '../../lib/journeys/accountJourneys.js';
import { isJourneyId } from '../../lib/journeys/generatedJourneySpecs.js';
import { BrowserController } from './browserTools.js';

export interface JourneyToolParams {
  journeyId: string;
  user?: TestUser;
}

export interface JourneyToolResult extends JourneyResult {}

export interface JourneyTools {
  runJourney(params: JourneyToolParams): Promise<JourneyToolResult>;
}

export interface JourneyBrowserSession {
  getPage(): Promise<Page>;
  dispose(): Promise<void>;
}

export type JourneyBrowserSessionFactory = () => JourneyBrowserSession;

const resolveJourney = (journeyId: string): ((page: Page, user: TestUser) => Promise<JourneyResult>) => {
  if (!isJourneyId(journeyId)) {
    throw new Error(`Unknown journey: ${journeyId}`);
  }
  return journeys[journeyId];
};

export const withIsolatedBrowserSession = async <Result>(
  createSession: JourneyBrowserSessionFactory,
  operation: (session: JourneyBrowserSession) => Promise<Result>
): Promise<Result> => {
  const session = createSession();
  try {
    return await operation(session);
  } finally {
    await session.dispose();
  }
};

export const createJourneyTools = (
  createSession: JourneyBrowserSessionFactory = () => new BrowserController()
): JourneyTools => {
  return {
    runJourney: async ({ journeyId, user }: JourneyToolParams): Promise<JourneyToolResult> => {
      const journey = resolveJourney(journeyId);
      const activeUser = user ?? demoUser;
      return withIsolatedBrowserSession(createSession, async (session) => {
        const page = await session.getPage();
        return journey(page, activeUser);
      });
    }
  };
};
