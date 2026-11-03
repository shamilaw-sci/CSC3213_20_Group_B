import type {} from 'webmcp-types';
import { z } from 'zod';

export type ToolInputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean;
};

/** A message that is safe to return to a browser agent. */
export class WebMcpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebMcpToolError';
  }
}

export function parseToolInput<T extends z.ZodType>(
  schema: T,
  input: unknown
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new WebMcpToolError(
      `Invalid tool input: ${z.prettifyError(result.error)}`
    );
  }
  return result.data;
}

export function isWebMcpSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    'modelContext' in document &&
    typeof document.modelContext?.registerTool === 'function'
  );
}

/** An optional polyfill loader must install the current document.modelContext API. */
export async function initializeWebMcp(
  loadPolyfill?: () => Promise<void>
): Promise<boolean> {
  if (isWebMcpSupported()) return true;
  if (typeof document === 'undefined' || !loadPolyfill) return false;
  await loadPolyfill();
  if (!isWebMcpSupported()) {
    throw new Error('WebMCP polyfill did not install document.modelContext');
  }
  return true;
}
