import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Frame } from 'playwright';

import {
  createBrowserSecurityPolicy,
  resolveScreenshotPath,
  validateNavigationUrl,
  writeScreenshotFile
} from '../../src/mcp/security.js';
import { BrowserController } from '../../src/mcp/tools/browserTools.js';
import { withIsolatedBrowserSession, type JourneyBrowserSession } from '../../src/mcp/tools/journeyTools.js';

interface SecurityFixture {
  environment: Record<string, string>;
  allowedNavigations: Array<{ input: string; normalized: string }>;
  blockedNavigations: string[];
  validScreenshotFilenames: string[];
  invalidScreenshotFilenames: string[];
}

const fixture = JSON.parse(
  fs.readFileSync(new URL('../../../../common/specs/mcp-security.json', import.meta.url), 'utf8')
) as SecurityFixture;

test('navigation policy allows configured origins and blocks unsafe destinations', () => {
  const policy = createBrowserSecurityPolicy(fixture.environment);

  for (const { input, normalized } of fixture.allowedNavigations) {
    assert.equal(validateNavigationUrl(input, policy.allowedOrigins), normalized);
  }
  for (const input of fixture.blockedNavigations) {
    assert.throws(() => validateNavigationUrl(input, policy.allowedOrigins));
  }
  assert.throws(
    () => createBrowserSecurityPolicy({ BASE_URL: 'https://app.example.test', MCP_ALLOWED_ORIGINS: 'https://app.example.test/path' }),
    /scheme, host, and optional port/
  );
});

test('document navigation guard records a networkless document violation', async () => {
  const controller = new BrowserController(createBrowserSecurityPolicy({ BASE_URL: 'https://app.example.test' }));
  const frame = {
    url: () => 'about:blank',
    page: () => ({})
  } as unknown as Frame;
  const guard = controller as unknown as { guardDocumentNavigation(frame: Frame): void };

  guard.guardDocumentNavigation(frame);

  await assert.rejects(controller.assertDocumentNavigationsAllowed(), /about:blank/);
});

test('screenshot paths remain confined and are created exclusively', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-adventures-'));
  const policy = createBrowserSecurityPolicy(
    { BASE_URL: 'https://app.example.test', MCP_SCREENSHOT_DIR: 'captures' },
    temporaryDirectory
  );

  try {
    for (const filename of fixture.validScreenshotFilenames) {
      assert.equal(resolveScreenshotPath(policy, filename), path.join(temporaryDirectory, 'captures', filename));
    }
    assert.equal(resolveScreenshotPath(policy, undefined, 1234), path.join(temporaryDirectory, 'captures', 'shot-1234.png'));
    for (const filename of fixture.invalidScreenshotFilenames) {
      assert.throws(() => resolveScreenshotPath(policy, filename));
    }

    const firstTarget = await writeScreenshotFile(policy, 'account.png', Buffer.from('image'));
    assert.equal(firstTarget, path.join(temporaryDirectory, 'captures', 'account.png'));
    assert.equal(fs.readFileSync(firstTarget, 'utf8'), 'image');
    await assert.rejects(writeScreenshotFile(policy, 'account.png', Buffer.from('replacement')), /already exists/);

    const outsideTarget = path.join(temporaryDirectory, 'outside.png');
    const linkedTarget = path.join(policy.screenshotDir, 'linked.png');
    fs.writeFileSync(outsideTarget, 'outside');
    fs.symlinkSync(outsideTarget, linkedTarget);
    await assert.rejects(writeScreenshotFile(policy, 'linked.png', Buffer.from('replacement')), /already exists/);
    assert.equal(fs.readFileSync(outsideTarget, 'utf8'), 'outside');

    const danglingLink = path.join(policy.screenshotDir, 'dangling.png');
    fs.symlinkSync(path.join(temporaryDirectory, 'missing.png'), danglingLink);
    await assert.rejects(writeScreenshotFile(policy, 'dangling.png', Buffer.from('image')), /already exists/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('isolated browser sessions are disposed after success and failure', async () => {
  let disposeCount = 0;
  const session: JourneyBrowserSession = {
    getPage: async () => {
      throw new Error('not used');
    },
    dispose: async () => {
      disposeCount += 1;
    }
  };

  assert.equal(await withIsolatedBrowserSession(() => session, async () => 'done'), 'done');
  await assert.rejects(
    withIsolatedBrowserSession(() => session, async () => {
      throw new Error('journey failed');
    }),
    /journey failed/
  );
  assert.equal(disposeCount, 2);
});
