import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { InMemoryTransport } from '@modelcontextprotocol/server';

import { createMcpServer, specResourceUri } from '../../src/mcp/index.js';
import { journeyIds } from '../../src/lib/journeys/generatedJourneySpecs.js';
import type { BrowserTools } from '../../src/mcp/tools/browserTools.js';
import type { JourneyTools } from '../../src/mcp/tools/journeyTools.js';

const browserTools: BrowserTools = {
  navigate: async ({ url }) => ({ success: true, message: 'Navigated', url }),
  click: async ({ selector }) => ({ success: true, message: `Clicked ${selector}` }),
  fill: async ({ selector }) => ({ success: true, message: `Filled ${selector}` }),
  getText: async () => ({ success: true, message: 'Text retrieved', value: 'stub text' }),
  screenshot: async () => ({
    success: true,
    message: 'Screenshot captured',
    screenshotPath: '/tmp/stub.png'
  })
};

const journeyTools: JourneyTools = {
  runJourney: async ({ journeyId }) => ({ journeyId, success: true, details: 'Stub journey completed' })
};

test('exposes tools and resources through the MCP protocol', async () => {
  const server = createMcpServer({ browserTools, journeyTools });
  const client = new Client({ name: 'playwright-adventures-test', version: '0.1.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    assert.equal(client.getServerVersion()?.name, 'playwright-adventures-js');

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map(({ name }) => name).sort(),
      [
        'browser.click',
        'browser.fill',
        'browser.getText',
        'browser.navigate',
        'browser.screenshot',
        'test.runJourney'
      ]
    );
    const journeyTool = tools.tools.find(({ name }) => name === 'test.runJourney');
    const journeyInputSchema = journeyTool?.inputSchema as {
      properties?: { journeyId?: { enum?: unknown[] } };
    };
    assert.deepEqual(journeyInputSchema.properties?.journeyId?.enum, [...journeyIds]);

    const navigation = await client.callTool({
      name: 'browser.navigate',
      arguments: { url: 'https://example.test' }
    });
    assert.equal(navigation.isError, undefined);
    assert.deepEqual(navigation.structuredContent, {
      success: true,
      message: 'Navigated',
      url: 'https://example.test'
    });

    const invalidSelector = await client.callTool({
      name: 'browser.click',
      arguments: { selector: '   ' }
    });
    assert.equal(invalidSelector.isError, true);

    const unexpectedArgument = await client.callTool({
      name: 'browser.getText',
      arguments: { selector: '#status', unexpected: true }
    });
    assert.equal(unexpectedArgument.isError, true);

    const invalidJourney = await client.callTool({
      name: 'test.runJourney',
      arguments: { journeyId: 'unknown-journey' }
    });
    assert.equal(invalidJourney.isError, true);

    const resources = await client.listResources();
    assert.equal(resources.resources.length, 3);
    assert.ok(resources.resources.some(({ uri }) => uri === specResourceUri('journeys')));

    const selectors = await client.readResource({ uri: specResourceUri('selectors') });
    const content = selectors.contents[0];
    assert.ok(content && 'text' in content);
    assert.match(content.text, /Selector Policy/);
  } finally {
    await client.close();
  }
});

test('serves the current MCP protocol over clean stdio', async () => {
  const client = new Client(
    { name: 'playwright-adventures-stdio-test', version: '0.1.0' },
    { versionNegotiation: { mode: 'auto' } }
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('dist/src/mcp/index.js')],
    cwd: process.cwd(),
    stderr: 'pipe'
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  try {
    await client.connect(transport);
  } catch (error) {
    throw new Error(`stdio connection failed: ${stderr}\n${String(error)}`);
  }

  try {
    assert.equal(client.getProtocolEra(), 'modern');
    assert.ok(client.getDiscoverResult());
    assert.equal(client.getServerVersion()?.name, 'playwright-adventures-js');
    assert.equal((await client.listTools()).tools.length, 6);
    assert.equal((await client.listResources()).resources.length, 3);
  } finally {
    await client.close();
  }
});
