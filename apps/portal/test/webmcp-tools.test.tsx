import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

type Tool = {
  name: string;
  enabled?: boolean;
  execute: () => unknown | Promise<unknown>;
};

const tools: Tool[] = [];
const push = mock(() => {});
let session: { user: { name: string; email: string } } | null = null;
let isPending = false;

mock.module('@scs/webmcp/react', () => ({
  useWebMcpTool: (tool: Tool) => {
    tools.push(tool);
  },
}));
mock.module('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
mock.module('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: session, isPending }),
    getSession: async () => ({ data: session, error: null }),
  },
}));

const { WebMcpTools } = await import('@/components/webmcp-tools');

function renderTools() {
  tools.length = 0;
  renderToStaticMarkup(<WebMcpTools />);
  return tools;
}

describe('portal WebMCP session integration', () => {
  test('gates both tools through pending, signed-in, and signed-out states', () => {
    session = null;
    isPending = true;
    expect(renderTools().every((tool) => tool.enabled === false)).toBe(true);

    session = { user: { name: 'Test Member', email: 'member@example.test' } };
    expect(renderTools().every((tool) => tool.enabled === false)).toBe(true);

    isPending = false;
    expect(renderTools().map((tool) => [tool.name, tool.enabled])).toEqual([
      ['portal.current_account', true],
      ['portal.open_account', true],
    ]);

    session = null;
    expect(renderTools().every((tool) => tool.enabled === false)).toBe(true);
  });

  test('revalidates the session when a previously discovered tool runs', async () => {
    session = { user: { name: 'Test Member', email: 'member@example.test' } };
    isPending = false;
    const registered = renderTools();
    const account = registered.find(
      (tool) => tool.name === 'portal.current_account'
    );
    const open = registered.find((tool) => tool.name === 'portal.open_account');
    expect(await account?.execute()).toEqual({
      name: 'Test Member',
      email: 'member@example.test',
    });

    session = null;
    await expect(account?.execute()).rejects.toThrow('Sign in again');
    await expect(open?.execute()).rejects.toThrow('Sign in again');
    expect(push).not.toHaveBeenCalled();
  });
});
