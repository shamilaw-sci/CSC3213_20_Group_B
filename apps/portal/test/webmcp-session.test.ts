import { describe, expect, it } from 'bun:test';

import { portalToolsEnabled } from '@/lib/webmcp-session';

describe('portal WebMCP availability', () => {
  it('only exposes account tools for a settled signed-in session', () => {
    expect(portalToolsEnabled(true, false)).toBe(false);
    expect(portalToolsEnabled(true, true)).toBe(false);
    expect(portalToolsEnabled(false, false)).toBe(false);
    expect(portalToolsEnabled(false, true)).toBe(true);
  });
});
