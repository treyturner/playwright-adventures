import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { BrowserContext } from 'playwright';

import { createBrowserSecurityPolicy } from '../../src/mcp/security.js';
import { BrowserController } from '../../src/mcp/tools/browserTools.js';

const scenarios = [
  {
    name: 'a blob main-frame navigation',
    observeUrl: async (context: BrowserContext) =>
      (await context.waitForEvent('framenavigated', { predicate: (frame) => frame.url().startsWith('blob:'), timeout: 10_000 })).url(),
    trigger: `() => {
      const documentBlob = new Blob(['<h1>blocked</h1>'], { type: 'text/html' });
      window.location.href = URL.createObjectURL(documentBlob);
    }`
  },
  {
    name: 'an about:srcdoc child frame',
    observeUrl: async (context: BrowserContext) =>
      (await context.waitForEvent('framenavigated', { predicate: (frame) => frame.url() === 'about:srcdoc', timeout: 10_000 })).url(),
    trigger: `() => {
      const frame = document.createElement('iframe');
      frame.srcdoc = '<h1>blocked</h1>';
      document.body.append(frame);
    }`
  },
  {
    name: 'an about:blank popup',
    observeUrl: async (context: BrowserContext) =>
      (await context.waitForEvent('page', { predicate: (page) => page.url() === 'about:blank', timeout: 10_000 })).url(),
    trigger: `() => window.open('about:blank', '_blank')`
  }
] as const;

test('context-wide navigation enforcement catches networkless documents and closes the context', async (suite) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><body><h1>Allowed document</h1></body></html>');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  const baseURL = `http://127.0.0.1:${port}/`;

  try {
    for (const scenario of scenarios) {
      await suite.test(scenario.name, async () => {
        const controller = new BrowserController(createBrowserSecurityPolicy({ BASE_URL: baseURL }));

        try {
          const page = await controller.getPage();
          await page.goto(baseURL);
          const context = page.context();
          const observedUrl = scenario.observeUrl(context);

          await page.evaluate(`(${scenario.trigger})()`).catch(() => undefined);
          const documentUrl = await observedUrl;

          assert.match(documentUrl, /^(?:blob:|about:(?:srcdoc|blank))/);
          await assert.rejects(controller.assertDocumentNavigationsAllowed(), /Document navigation blocked/);
          assert.equal(page.isClosed(), true);
          assert.equal(context.pages().length, 0);
        } finally {
          await controller.dispose();
        }
      });
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
