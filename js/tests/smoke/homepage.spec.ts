import { expect, test } from '@playwright/test';
import { HomePage } from '../../src/lib/pages/HomePage.js';

const HERO_HEADING = /welcome/i;

test('homepage renders hero heading', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();
  await home.expectHeroHeading(HERO_HEADING);
});
