import { test } from '@playwright/test';
import { demoUser } from '../../src/lib/fixtures/testUsers.js';
import { viewAccountDetailsJourney } from '../../src/lib/journeys/accountJourneys.js';

test('user can view account details', async ({ page }) => {
  await viewAccountDetailsJourney(page, demoUser);
});
