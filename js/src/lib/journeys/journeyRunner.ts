import { expect, Locator, Page } from '@playwright/test';
import { TestUser } from '../fixtures/testUsers.js';
import { isJourneyId, JourneyId, journeySpecs } from './generatedJourneySpecs.js';
import type { FixtureValue, SelectorSpec, TextPattern } from './journeyTypes.js';

const toRegExp = ({ pattern, ignoreCase }: TextPattern): RegExp => new RegExp(pattern, ignoreCase ? 'i' : '');

const resolveLocator = (page: Page, selector: SelectorSpec): Locator => {
  let locator: Locator;

  switch (selector.by) {
    case 'role': {
      const options = {
        ...(selector.name === null ? {} : { name: toRegExp(selector.name) }),
        ...(selector.level === null ? {} : { level: selector.level })
      };
      locator = page.getByRole(selector.role, options);
      break;
    }
    case 'label':
      locator = page.getByLabel(toRegExp(selector.name));
      break;
    case 'testId':
      locator = page.getByTestId(selector.value);
      break;
  }

  return selector.first ? locator.first() : locator;
};

const resolveFixtureValue = (user: TestUser, value: FixtureValue): string => {
  switch (value) {
    case 'user.email':
      return user.email;
    case 'user.password':
      return user.password;
    case 'user.displayName':
      if (user.displayName === undefined) {
        throw new Error('Journey requires user.displayName, but the fixture value is undefined');
      }
      return user.displayName;
  }
};

export const executeJourney = async (
  page: Page,
  user: TestUser,
  journeyId: JourneyId,
  activeJourneyIds: readonly JourneyId[] = []
): Promise<void> => {
  if (activeJourneyIds.includes(journeyId)) {
    throw new Error(`Journey inheritance cycle while executing ${journeyId}`);
  }

  const spec = journeySpecs[journeyId];
  if (spec.extends !== null) {
    if (!isJourneyId(spec.extends)) {
      throw new Error(`Journey ${journeyId} extends unknown journey: ${spec.extends}`);
    }
    await executeJourney(page, user, spec.extends, [...activeJourneyIds, journeyId]);
  }

  for (const step of spec.steps) {
    switch (step.action) {
      case 'navigate':
        await page.goto(step.path);
        break;
      case 'click':
        await resolveLocator(page, step.selector).click();
        break;
      case 'fill':
        await resolveLocator(page, step.selector).fill(resolveFixtureValue(user, step.value));
        break;
      case 'assert-visible':
        await expect(resolveLocator(page, step.selector)).toBeVisible();
        break;
    }
  }
};
