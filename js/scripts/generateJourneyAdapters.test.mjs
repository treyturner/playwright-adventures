import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGeneratedAdapters,
  generateAdapters,
  generatePython,
  generateTypeScript,
  parseJourneyDocument
} from './generateJourneyAdapters.mjs';

const journey = (id, parent = null) => ({
  id,
  name: id,
  description: `${id} description`,
  successMessage: `${id} completed`,
  ...(parent === null ? {} : { extends: parent }),
  preconditions: [],
  steps: [{ action: 'navigate', path: '/' }]
});

test('normalizes optional fields before generating deterministic adapters', () => {
  const document = parseJourneyDocument({ version: 1, journeys: [journey('example')] });

  assert.equal(document.journeys[0].extends, null);
  assert.equal(generateTypeScript(document), generateTypeScript(document));
  assert.equal(generatePython(document), generatePython(document));
  assert.match(buildGeneratedAdapters({ version: 1, journeys: [journey('example')] }).typescript, /example/);
});

test('rejects duplicate journey ids', () => {
  assert.throws(
    () => parseJourneyDocument({ version: 1, journeys: [journey('duplicate'), journey('duplicate')] }),
    /Duplicate journey id: duplicate/
  );
});

test('rejects an unknown inherited journey', () => {
  assert.throws(
    () => parseJourneyDocument({ version: 1, journeys: [journey('child', 'missing')] }),
    /extends unknown journey: missing/
  );
});

test('rejects journey inheritance cycles', () => {
  assert.throws(
    () => parseJourneyDocument({ version: 1, journeys: [journey('first', 'second'), journey('second', 'first')] }),
    /Journey inheritance cycle/
  );
});

test('rejects unsupported actions and selectors', () => {
  const invalid = journey('invalid');
  invalid.steps = [{ action: 'assert', target: '#status' }];

  assert.throws(() => parseJourneyDocument({ version: 1, journeys: [invalid] }));
});

test('rejects legacy raw regular expressions', () => {
  const invalid = journey('raw-pattern');
  invalid.steps = [
    {
      action: 'click',
      selector: { by: 'label', name: { pattern: '(?<word>foo)', ignoreCase: true } }
    }
  ];

  assert.throws(() => parseJourneyDocument({ version: 1, journeys: [invalid] }));
});

test('accepts regex syntax as literal matcher text', () => {
  const literal = journey('literal-pattern');
  literal.steps = [
    {
      action: 'click',
      selector: {
        by: 'label',
        name: { values: ['(?<word>foo)'], ignoreCase: false, exact: true }
      }
    }
  ];

  const document = parseJourneyDocument({ version: 1, journeys: [literal] });
  assert.deepEqual(document.journeys[0].steps[0].selector.name.values, ['(?<word>foo)']);
});

test('committed adapters match the canonical YAML', async () => {
  await assert.doesNotReject(generateAdapters({ check: true }));
});
