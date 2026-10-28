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

  test('publishes the deterministic repository variant without placeholders', async () => {
    const response = await getPage(new Request('https://docs.test'), {
      params: Promise.resolve({ slug: ['development', 'content.md'] }),
    });
    const markdown = await response.text();

    expect(markdown).toContain(
      'git clone https://github.com/csc3213-2026-group-b/scs-pdn-monorepo.git'
    );
    expect(markdown).toContain('Set-Location scs-pdn-monorepo');
    expect(markdown).not.toContain('{{repo.');
    expect(markdown).not.toContain(' repo title=');
  });

  test('rejects an unknown Markdown page', async () => {
    await expect(
      getPage(new Request('https://docs.test'), {
        params: Promise.resolve({ slug: ['missing', 'content.md'] }),
      })
    ).rejects.toThrow();
  });

  test('rejects paths without the canonical content.md suffix', async () => {
    await expect(
      getPage(new Request('https://docs.test'), {
        params: Promise.resolve({ slug: ['architecture', 'anything'] }),
      })
    ).rejects.toThrow();

    await expect(
      getPage(new Request('https://docs.test'), {
        params: Promise.resolve({ slug: ['missing'] }),
      })
    ).rejects.toThrow();
  });
});
