import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Frame } from 'playwright';

import {
  createBrowserSecurityPolicy,
  resolveScreenshotPath,
  validateNavigationUrl
} from '../../src/mcp/security.js';
import { BrowserController } from '../../src/mcp/tools/browserTools.js';
import { withIsolatedBrowserSession, type JourneyBrowserSession } from '../../src/mcp/tools/journeyTools.js';

test('navigation policy allows configured origins and blocks unsafe destinations', () => {
  const policy = createBrowserSecurityPolicy({
    BASE_URL: 'https://app.example.test/',
    MCP_ALLOWED_ORIGINS: 'https://app.example.test, https://login.example.test'
  });

  assert.equal(validateNavigationUrl('https://app.example.test/account', policy.allowedOrigins), 'https://app.example.test/account');
  assert.equal(validateNavigationUrl('https://login.example.test/start', policy.allowedOrigins), 'https://login.example.test/start');
  assert.throws(
    () => validateNavigationUrl('https://outside.example.test', policy.allowedOrigins),
    /origin .* is not allowed/
  );
  assert.throws(() => validateNavigationUrl('file:///etc/passwd', policy.allowedOrigins), /HTTP or HTTPS/);
  for (const networklessUrl of ['about:blank', 'about:srcdoc', 'blob:https://app.example.test/id']) {
    assert.throws(() => validateNavigationUrl(networklessUrl, policy.allowedOrigins), /HTTP or HTTPS/);
  }
  assert.throws(() => validateNavigationUrl('https://user:secret@app.example.test', policy.allowedOrigins), /credentials/);
  assert.throws(
    () => createBrowserSecurityPolicy({ BASE_URL: 'https://app.example.test', MCP_ALLOWED_ORIGINS: 'https://app.example.test/path' }),
    /scheme, host, and optional port/
  );
});

test('document navigation guard records and closes a networkless document', async () => {
  const controller = new BrowserController(createBrowserSecurityPolicy({ BASE_URL: 'https://app.example.test' }));
  let closed = false;
  const frame = {
    url: () => 'about:blank',
    page: () => ({
      close: async () => {
        closed = true;
      }
    })
  } as unknown as Frame;
  const guard = controller as unknown as { guardDocumentNavigation(frame: Frame): void };

  guard.guardDocumentNavigation(frame);

  assert.throws(() => controller.assertDocumentNavigationsAllowed(), /about:blank/);
  await Promise.resolve();
  assert.equal(closed, true);
});

test('screenshot paths remain confined to the configured directory', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-adventures-'));
  const policy = createBrowserSecurityPolicy(
    { BASE_URL: 'https://app.example.test', MCP_SCREENSHOT_DIR: 'captures' },
    temporaryDirectory
  );

  try {
    assert.equal(resolveScreenshotPath(policy, 'account.png'), path.join(temporaryDirectory, 'captures', 'account.png'));
    assert.equal(resolveScreenshotPath(policy, undefined, 1234), path.join(temporaryDirectory, 'captures', 'shot-1234.png'));
    assert.throws(() => resolveScreenshotPath(policy, '../escape.png'), /must be a filename/);
    assert.throws(() => resolveScreenshotPath(policy, 'nested/escape.png'), /must be a filename/);
    assert.throws(() => resolveScreenshotPath(policy, '/tmp/escape.png'), /must be a filename/);
    assert.throws(() => resolveScreenshotPath(policy, 'capture.txt'), /must end in/);

    const outsideTarget = path.join(temporaryDirectory, 'outside.png');
    const linkedTarget = path.join(policy.screenshotDir, 'linked.png');
    fs.writeFileSync(outsideTarget, 'outside');
    fs.symlinkSync(outsideTarget, linkedTarget);
    assert.throws(() => resolveScreenshotPath(policy, 'linked.png'), /symbolic link/);

    const danglingLink = path.join(policy.screenshotDir, 'dangling.png');
    fs.symlinkSync(path.join(temporaryDirectory, 'missing.png'), danglingLink);
    assert.throws(() => resolveScreenshotPath(policy, 'dangling.png'), /symbolic link/);
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
