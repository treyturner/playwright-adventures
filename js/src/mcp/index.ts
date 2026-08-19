import { pathToFileURL } from 'node:url';

import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

import { loadSpecResources } from './resources/specsResource.js';
import {
  BrowserController,
  createBrowserTools,
  type BrowserActionResult,
  type BrowserTools
} from './tools/browserTools.js';
import { createJourneyTools, type JourneyToolResult, type JourneyTools } from './tools/journeyTools.js';
import type { McpResource } from './types.js';

const browserActionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  url: z.string().optional(),
  value: z.string().optional(),
  screenshotPath: z.string().optional()
});

const journeyResultSchema = z.object({
  journeyId: z.string(),
  success: z.boolean(),
  details: z.string().optional()
});

const testUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  displayName: z.string().optional()
});

export interface McpServerDependencies {
  browserTools: BrowserTools;
  journeyTools: JourneyTools;
  resources?: McpResource[];
}

const toToolResult = (result: BrowserActionResult | JourneyToolResult): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  structuredContent: { ...result }
});

export const specResourceUri = (resourceId: string): string =>
  `playwright-adventures://specs/${resourceId}`;

export const createMcpServer = ({
  browserTools,
  journeyTools,
  resources = loadSpecResources()
}: McpServerDependencies): McpServer => {
  const server = new McpServer({
    name: 'playwright-adventures-js',
    version: '0.1.0'
  });

  server.registerTool(
    'browser.navigate',
    {
      title: 'Navigate browser',
      description: 'Navigate the managed browser page to a URL',
      inputSchema: z.object({ url: z.string().min(1) }),
      outputSchema: browserActionResultSchema
    },
    async (params) => toToolResult(await browserTools.navigate(params))
  );

  server.registerTool(
    'browser.click',
    {
      title: 'Click browser element',
      description: 'Click an element matching a Playwright selector',
      inputSchema: z.object({ selector: z.string().min(1) }),
      outputSchema: browserActionResultSchema
    },
    async (params) => toToolResult(await browserTools.click(params))
  );

  server.registerTool(
    'browser.fill',
    {
      title: 'Fill browser input',
      description: 'Fill an input matching a Playwright selector',
      inputSchema: z.object({ selector: z.string().min(1), value: z.string() }),
      outputSchema: browserActionResultSchema
    },
    async (params) => toToolResult(await browserTools.fill(params))
  );

  server.registerTool(
    'browser.getText',
    {
      title: 'Read browser text',
      description: 'Read text content from an element matching a Playwright selector',
      inputSchema: z.object({ selector: z.string().min(1) }),
      outputSchema: browserActionResultSchema
    },
    async (params) => toToolResult(await browserTools.getText(params))
  );

  server.registerTool(
    'browser.screenshot',
    {
      title: 'Capture browser screenshot',
      description: 'Capture a full-page screenshot from the managed browser page',
      inputSchema: z.object({ path: z.string().min(1).optional() }),
      outputSchema: browserActionResultSchema
    },
    async (params) => toToolResult(await browserTools.screenshot(params))
  );

  server.registerTool(
    'test.runJourney',
    {
      title: 'Run browser journey',
      description: 'Run one of the predefined browser journeys',
      inputSchema: z.object({
        journeyId: z.enum(['login-and-view-dashboard', 'view-account-details']),
        user: testUserSchema.optional()
      }),
      outputSchema: journeyResultSchema
    },
    async (params) => toToolResult(await journeyTools.runJourney(params))
  );

  for (const resource of resources) {
    server.registerResource(
      resource.id,
      specResourceUri(resource.id),
      {
        title: resource.name,
        description: `Shared Playwright specification: ${resource.name}`,
        mimeType: resource.mimeType
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: resource.mimeType, text: resource.content }]
      })
    );
  }

  return server;
};

const createRuntimeServer = (): McpServer => {
  const controller = new BrowserController();
  const server = createMcpServer({
    browserTools: createBrowserTools(controller),
    journeyTools: createJourneyTools(controller)
  });

  server.server.onclose = () => {
    void controller.dispose();
  };

  return server;
};

export const startStdioServer = (): void => {
  const handle = serveStdio(createRuntimeServer, {
    onerror: (error) => console.error('MCP stdio transport error:', error)
  });
  let shuttingDown = false;

  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    void handle.close().catch((error: unknown) => {
      console.error('Failed to shut down MCP server:', error);
      process.exitCode = 1;
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  console.error('Playwright Adventures MCP server running on stdio');
};

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  startStdioServer();
}
