import {
  initializeWebMcp,
  isWebMcpSupported,
  parseToolInput,
  WebMcpToolError,
} from '@scs/webmcp';
import { useWebMcpTool } from '@scs/webmcp/react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const schema = z.object({ query: z.string().min(2) }).strict();
const inputSchema = {
  type: 'object',
  properties: { query: { type: 'string' } },
  required: ['query'],
} as const;

function mockModelContext() {
  const registerTool = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: { registerTool },
  });
  return registerTool;
}

afterEach(() => {
  Reflect.deleteProperty(document, 'modelContext');
  vi.restoreAllMocks();
});

describe('WebMCP browser integration', () => {
  it('detects support and accepts an optional polyfill loader', async () => {
    expect(isWebMcpSupported()).toBe(false);
    expect(await initializeWebMcp()).toBe(false);
    const loader = vi.fn(async () => {
      mockModelContext();
    });
    expect(await initializeWebMcp(loader)).toBe(true);
    expect(loader).toHaveBeenCalledOnce();
    expect(await initializeWebMcp(loader)).toBe(true);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('reports an invalid polyfill without claiming support', async () => {
    await expect(initializeWebMcp(async () => {})).rejects.toThrow(
      'did not install'
    );
  });

  it('validates untrusted inputs', () => {
    expect(parseToolInput(schema, { query: 'staff' })).toEqual({
      query: 'staff',
    });
    expect(() => parseToolInput(schema, { query: 'x' })).toThrow(
      'Invalid tool input'
    );
    expect(() => parseToolInput(schema, { query: 'staff', extra: 1 })).toThrow(
      'Invalid tool input'
    );
  });

  it('registers once across rerenders and aborts on unmount', async () => {
    const registerTool = mockModelContext();
    const execute = vi.fn(({ query }: { query: string }) => ({ query }));
    const { rerender, unmount } = renderHook(() =>
      useWebMcpTool({
        name: 'test.search',
        description: 'Searches test data',
        schema,
        inputSchema,
        execute,
      })
    );
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [registered, options] = registerTool.mock.calls[0];
    rerender();
    expect(registerTool).toHaveBeenCalledOnce();
    const result = await act(async () =>
      registered.execute(
        { query: 'staff' },
        { signal: new AbortController().signal }
      )
    );
    expect(result).toEqual({
      content: [{ type: 'text', text: '{"query":"staff"}' }],
    });
    expect(execute).toHaveBeenCalledOnce();
    unmount();
    expect(options.signal.aborted).toBe(true);
  });

  it('does not register the discarded StrictMode effect', async () => {
    const registerTool = mockModelContext();
    renderHook(
      () =>
        useWebMcpTool({
          name: 'test.search',
          description: 'Searches test data',
          schema,
          inputSchema,
          execute: () => 'ok',
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>{children}</StrictMode>
        ),
      }
    );
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
  });

  it('does not register while disabled and exposes validation errors to the agent', async () => {
    const registerTool = mockModelContext();
    const { rerender } = renderHook(
      ({ enabled }) =>
        useWebMcpTool({
          name: 'test.search',
          description: 'Searches test data',
          schema,
          inputSchema,
          enabled,
          execute: () => 'ok',
        }),
      { initialProps: { enabled: false } }
    );
    expect(registerTool).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [registered] = registerTool.mock.calls[0];
    const result = await act(async () =>
      registered.execute(
        { query: 'x' },
        { signal: new AbortController().signal }
      )
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid tool input');
  });

  it('reports registration failures without crashing the page', async () => {
    const registerTool = mockModelContext();
    registerTool.mockRejectedValue(new Error('tools permission denied'));
    const { result } = renderHook(() =>
      useWebMcpTool({
        name: 'test.search',
        description: 'Searches test data',
        schema,
        inputSchema,
        execute: () => 'ok',
      })
    );
    await waitFor(() =>
      expect(result.current.error?.message).toBe('tools permission denied')
    );
    expect(result.current.registered).toBe(false);
  });

  it('reports oversized output without returning truncated JSON', async () => {
    const registerTool = mockModelContext();
    renderHook(() =>
      useWebMcpTool({
        name: 'test.search',
        description: 'Searches test data',
        schema,
        inputSchema,
        execute: () => ({ text: 'x'.repeat(1600) }),
      })
    );
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [registered] = registerTool.mock.calls[0];
    const result = await act(async () =>
      registered.execute(
        { query: 'test' },
        { signal: new AbortController().signal }
      )
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Narrow the search');
  });

  it('does not expose unexpected exception messages or thrown values', async () => {
    const registerTool = mockModelContext();
    const onError = vi.fn();
    renderHook(() =>
      useWebMcpTool({
        name: 'test.search',
        description: 'Searches test data',
        schema,
        inputSchema,
        execute: () => {
          throw new Error('Bearer private-token at /internal/service');
        },
        onError,
      })
    );
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [registered] = registerTool.mock.calls[0];
    const result = await registered.execute(
      { query: 'test' },
      { signal: new AbortController().signal }
    );
    expect(result).toEqual({
      content: [
        { type: 'text', text: 'Tool failed. Retry or use the site directly.' },
      ],
      isError: true,
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Bearer private-token at /internal/service',
      })
    );
  });

  it('preserves deliberate public errors and bounds the complete result', async () => {
    const registerTool = mockModelContext();
    const { rerender } = renderHook(
      ({ fail }) =>
        useWebMcpTool({
          name: 'test.search',
          description: 'Searches test data',
          schema,
          inputSchema,
          execute: () => {
            if (fail) throw new WebMcpToolError('Search again.');
            return 'x'.repeat(1480);
          },
        }),
      { initialProps: { fail: true } }
    );
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [registered] = registerTool.mock.calls[0];
    expect(
      await registered.execute(
        { query: 'test' },
        { signal: new AbortController().signal }
      )
    ).toEqual({
      content: [{ type: 'text', text: 'Search again.' }],
      isError: true,
    });
    rerender({ fail: false });
    const result = await registered.execute(
      { query: 'test' },
      { signal: new AbortController().signal }
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
  });

  it('bounds a public error even when JSON escaping expands its text', async () => {
    const registerTool = mockModelContext();
    renderHook(() =>
      useWebMcpTool({
        name: 'test.search',
        description: 'Searches test data',
        schema,
        inputSchema,
        execute: () => {
          throw new WebMcpToolError('"'.repeat(1400));
        },
      })
    );
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [registered] = registerTool.mock.calls[0];
    const result = await registered.execute(
      { query: 'test' },
      { signal: new AbortController().signal }
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
  });

  it('does not return an in-flight result after its owner unmounts', async () => {
    const registerTool = mockModelContext();
    let finish!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const { unmount } = renderHook(() =>
      useWebMcpTool({
        name: 'test.search',
        description: 'Searches test data',
        schema,
        inputSchema,
        execute: () => pending,
      })
    );
    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [registered] = registerTool.mock.calls[0];
    const resultPromise = registered.execute(
      { query: 'test' },
      { signal: new AbortController().signal }
    );
    unmount();
    finish('private result');
    const result = await resultPromise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Tool is no longer available.');
  });

  it('keeps the newer registration after rapid remount and late settlement', async () => {
    const active = new Map<string, AbortSignal>();
    const finish: Array<() => void> = [];
    const registerTool = vi.fn(
      (definition: { name: string }, options: { signal: AbortSignal }) => {
        if (active.has(definition.name))
          return Promise.reject(new Error('duplicate'));
        active.set(definition.name, options.signal);
        options.signal.addEventListener('abort', () => {
          if (active.get(definition.name) === options.signal)
            active.delete(definition.name);
        });
        return new Promise<void>((resolve) => finish.push(resolve));
      }
    );
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool },
    });
    const tool = {
      name: 'test.search',
      description: 'Searches test data',
      schema,
      inputSchema,
      execute: () => 'ok',
    };
    const first = renderHook(() => useWebMcpTool(tool));
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(1));
    first.unmount();
    const second = renderHook(() => useWebMcpTool(tool));
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(2));
    await act(async () => {
      finish[1]();
      finish[0]();
    });
    expect(second.result.current.registered).toBe(true);
    expect(active.has(tool.name)).toBe(true);
    second.unmount();
    expect(active.has(tool.name)).toBe(false);
  });
});
