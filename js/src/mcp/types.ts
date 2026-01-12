export interface RpcRequest {
  id: string | number;
  method: string;
  params?: unknown;
}

export interface RpcResponse {
  id: string | number;
  result?: unknown;
  error?: { message: string; };
}

export type ToolHandler = (params: unknown) => Promise<unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  handler: ToolHandler;
}

export interface McpResource {
  id: string;
  name: string;
  mimeType: string;
  path: string;
  content: string;
}
