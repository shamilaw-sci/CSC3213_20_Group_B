import { describe, expect, test } from 'vitest';

import { GET as getPage } from '@/app/llms.mdx/docs/[[...slug]]/route';
import { GET as getIndex } from '@/app/llms.txt/route';
import { GET as getFull } from '@/app/llms-full.txt/route';

describe('agent-readable documentation', () => {
  test('publishes an index and full handbook from root docs', async () => {
    const index = await getIndex();
    const full = await getFull();
    const indexText = await index.text();
    const fullText = await full.text();

    expect(index.headers.get('content-type')).toContain('text/plain');
    expect(indexText).toContain('/docs/architecture');
    expect(fullText).toContain('# Architecture (/docs/architecture)');
    expect(fullText).not.toContain('# SCS PDN Monorepo');
  });

  test('publishes one page as Markdown', async () => {
    const response = await getPage(new Request('https://docs.test'), {
      params: Promise.resolve({ slug: ['architecture', 'content.md'] }),
    });

    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(await response.text()).toContain(
      '# Architecture (/docs/architecture)'
    );
  });

  test('rejects an unknown Markdown page', async () => {
    await expect(
      getPage(new Request('https://docs.test'), {
        params: Promise.resolve({ slug: ['missing', 'content.md'] }),
      })
    ).rejects.toThrow();
  });
});
