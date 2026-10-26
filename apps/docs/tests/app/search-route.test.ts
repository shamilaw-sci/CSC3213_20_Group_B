import { describe, expect, test } from 'vitest';

import { GET } from '@/app/api/search/route';

describe('static documentation search', () => {
  test('exports an index containing architecture content', async () => {
    const response = await GET();
    const content = await response.text();

    expect(response.status).toBe(200);
    expect(content).toContain('Architecture');
    expect(content).toContain('/docs/architecture');
  });
});
