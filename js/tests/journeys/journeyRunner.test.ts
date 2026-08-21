import assert from 'node:assert/strict';
import test from 'node:test';

import { toTextMatcherRegExp } from '../../src/lib/journeys/journeyRunner.js';

test('treats regex syntax in matcher values as literal text', () => {
  const matcher = toTextMatcherRegExp({
    values: ['(?<word>foo)', 'account.total'],
    ignoreCase: false,
    exact: true
  });

  assert.equal(matcher.test('(?<word>foo)'), true);
  assert.equal(matcher.test('account.total'), true);
  assert.equal(matcher.test('foo'), false);
  assert.equal(matcher.test('account-total'), false);
});

test('supports case-insensitive substring alternatives', () => {
  const matcher = toTextMatcherRegExp({
    values: ['sign in', 'log in'],
    ignoreCase: true,
    exact: false
  });

  assert.equal(matcher.test('Continue to SIGN IN now'), true);
  assert.equal(matcher.test('Log out'), false);
});
