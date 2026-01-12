import readline from 'readline';
import { BrowserController, createBrowserTools, NavigateParams, ClickParams, FillParams, GetTextParams, ScreenshotParams } from './tools/browserTools';
import { createJourneyTools, JourneyToolParams } from './tools/journeyTools';
import { loadSpecResources } from './resources/specsResource';
import { McpResource, RpcRequest, RpcResponse, ToolDefinition } from './types';

class McpServer {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly resources: McpResource[] = [];

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerResources(resources: McpResource[]): void {
    this.resources.push(...resources);
  }

  private async handleRequest(request: RpcRequest): Promise<RpcResponse> {
    const { id, method, params } = request;

    if (method === 'resources/list') {
      return { id, result: this.resources.map(({ id: resourceId, name, mimeType, path }) => ({ id: resourceId, name, mimeType, path })) };
    }

    if (method === 'resources/get') {
      const resourceId = (params as { id?: string })?.id;
      const resource = this.resources.find((item) => item.id === resourceId);
      if (!resource) {
        return { id, error: { message: `Resource not found: ${resourceId}` } };
      }
      return { id, result: resource };
    }

    const tool = this.tools.get(method);
    if (!tool) {
      return { id, error: { message: `Unknown method: ${method}` } };
    }

    try {
      const result = await tool.handler(params);
      return { id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { id, error: { message } };
    }
  }

  start(): void {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    console.log('MCP server ready. Send JSON-RPC lines like {"id":1,"method":"browser.navigate","params":{"url":"https://example.com"}}');

    rl.on('line', async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const request = JSON.parse(trimmed) as RpcRequest;
        const response = await this.handleRequest(request);
        process.stdout.write(`${JSON.stringify(response)}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process request';
        const fallback: RpcResponse = { id: 'unknown', error: { message } };
        process.stdout.write(`${JSON.stringify(fallback)}\n`);
      }
    });
  }
}

const bootstrap = (): void => {
  const controller = new BrowserController();
  const browserTools = createBrowserTools(controller);
  const journeyTools = createJourneyTools(controller);
  const server = new McpServer();

  server.registerResources(loadSpecResources());

  const tools: ToolDefinition[] = [
    { name: 'browser.navigate', description: 'Navigate to a URL', handler: (params) => browserTools.navigate(params as NavigateParams) },
    { name: 'browser.click', description: 'Click a selector', handler: (params) => browserTools.click(params as ClickParams) },
    { name: 'browser.fill', description: 'Fill input by selector', handler: (params) => browserTools.fill(params as FillParams) },
    { name: 'browser.getText', description: 'Read text content for a selector', handler: (params) => browserTools.getText(params as GetTextParams) },
    { name: 'browser.screenshot', description: 'Capture a screenshot of the current page', handler: (params) => browserTools.screenshot(params as ScreenshotParams) },
    { name: 'test.runJourney', description: 'Run a predefined journey', handler: (params) => journeyTools.runJourney(params as JourneyToolParams) }
  ];

  tools.forEach((tool) => server.registerTool(tool));

  const shutdown = async (): Promise<void> => {
    await controller.dispose();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.start();
};

bootstrap();
