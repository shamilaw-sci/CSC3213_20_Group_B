import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  tools: [] as Array<{
    name: string;
    execute: (input: { href: string }) => unknown;
  }>,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@scs/webmcp/react', () => ({
  useWebMcpTool: (tool: (typeof mocks.tools)[number]) => {
    mocks.tools.push(tool);
  },
}));

import { WebMcpTools } from '@/components/webmcp-tools';

describe('web WebMCP navigation', () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.tools.length = 0;
  });

  it('opens a known section and rejects an unlisted target', () => {
    render(<WebMcpTools />);
    const open = mocks.tools.find((tool) => tool.name === 'web.open_section');
    expect(open).toBeDefined();
    expect(open?.execute({ href: '/research' })).toEqual({
      opened: '/research',
    });
    expect(mocks.push).toHaveBeenCalledWith('/research');
    expect(() => open?.execute({ href: 'https://example.com' })).toThrow(
      'Unknown section'
    );
    expect(mocks.push).toHaveBeenCalledOnce();
  });
});
