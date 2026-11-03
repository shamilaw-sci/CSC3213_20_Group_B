'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import type {} from 'webmcp-types';
import { z } from 'zod';

import {
  isWebMcpSupported,
  parseToolInput,
  type ToolInputSchema,
  WebMcpToolError,
} from '#core';

export type WebMcpState = {
  supported: boolean;
  registered: boolean;
  error: Error | null;
};

export type ValidatedTool<T extends z.ZodType> = {
  name: string;
  description: string;
  schema: T;
  inputSchema: ToolInputSchema;
  annotations?: {
    readOnlyHint?: true;
    untrustedContentHint?: true;
    consequentialHint?: true;
  };
  enabled?: boolean;
  execute: (
    input: z.output<T>,
    options: { signal: AbortSignal }
  ) => unknown | Promise<unknown>;
  onError?: (error: unknown) => void;
};

function textResult(value: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError?: true;
} {
  if (value == null) return { content: [] };
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof text !== 'string')
    throw new WebMcpToolError('Tool result is too large. Narrow the search.');
  const result = { content: [{ type: 'text' as const, text }] };
  if (JSON.stringify(result).length > 1500)
    throw new WebMcpToolError('Tool result is too large. Narrow the search.');
  return result;
}

function errorResult(error: unknown) {
  const message =
    error instanceof WebMcpToolError
      ? error.message
      : 'Tool failed. Retry or use the site directly.';
  const result = (length: number) => ({
    content: [{ type: 'text' as const, text: message.slice(0, length) }],
    isError: true as const,
  });
  // JSON escaping can expand a public message beyond the response budget.
  let low = 0;
  let high = Math.min(message.length, 1500);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (JSON.stringify(result(middle)).length <= 1500) low = middle;
    else high = middle - 1;
  }
  return result(low);
}

/** Registers a validated tool for the lifetime of the owning React component. */
export function useWebMcpTool<T extends z.ZodType>(
  tool: ValidatedTool<T>
): WebMcpState {
  const [state, setState] = useState<WebMcpState>({
    supported: false,
    registered: false,
    error: null,
  });
  const [detectTick, redetect] = useReducer((value: number) => value + 1, 0);
  const executeRef = useRef(tool.execute);
  const onErrorRef = useRef(tool.onError);
  const schemaRef = useRef(tool.schema);
  const schemaKey = JSON.stringify(tool.inputSchema);
  const annotationsKey = JSON.stringify(tool.annotations);
  const enabled = tool.enabled ?? true;

  useEffect(() => {
    executeRef.current = tool.execute;
    onErrorRef.current = tool.onError;
    schemaRef.current = tool.schema;
  });

  useEffect(() => {
    if (!isWebMcpSupported()) {
      setState({ supported: false, registered: false, error: null });
      if (typeof document === 'undefined') return;
      let attempts = 0;
      const timer = setInterval(() => {
        if (isWebMcpSupported()) {
          clearInterval(timer);
          redetect();
        } else if (++attempts >= 20) {
          clearInterval(timer);
        }
      }, 500);
      return () => clearInterval(timer);
    }

    if (!enabled) {
      setState({ supported: true, registered: false, error: null });
      return;
    }

    const context = document.modelContext;
    if (!context) return;
    const controller = new AbortController();
    let disposed = false;
    setState({ supported: true, registered: false, error: null });

    const definition: WebMCP.ModelContextTool = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      async execute(input, options) {
        try {
          if (controller.signal.aborted || options.signal.aborted) {
            throw new WebMcpToolError('Tool is no longer available.');
          }
          const parsed = parseToolInput(schemaRef.current, input);
          const output = await executeRef.current(parsed, options);
          if (controller.signal.aborted || options.signal.aborted) {
            throw new WebMcpToolError('Tool is no longer available.');
          }
          if (output instanceof Error) throw output;
          return textResult(output);
        } catch (error) {
          try {
            onErrorRef.current?.(error);
          } catch {
            // A diagnostic callback must not hide the original tool error.
          }
          return errorResult(error);
        }
      },
    };
    const registration = Promise.resolve().then(() =>
      controller.signal.aborted
        ? undefined
        : context.registerTool(definition, { signal: controller.signal })
    );

    registration.then(
      () => {
        if (!disposed)
          setState({ supported: true, registered: true, error: null });
      },
      (error: unknown) => {
        if (!disposed)
          setState({
            supported: true,
            registered: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
      }
    );

    return () => {
      disposed = true;
      controller.abort();
    };
    // Discovered metadata changes require a fresh registration; callbacks stay current via refs.
  }, [
    tool.name,
    tool.description,
    schemaKey,
    annotationsKey,
    enabled,
    detectTick,
  ]);

  return state;
}
