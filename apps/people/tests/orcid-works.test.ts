import { afterEach, expect, spyOn, test } from 'bun:test';

import { getOrcidWorks, normalizeOrcidWorks } from '@/lib/orcid-works';

afterEach(() =>
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.()
);

function summary(code: number, title: string, doi?: string, year?: string) {
  return {
    'put-code': code,
    'display-index': '1',
    visibility: 'public',
    title: { title: { value: title } },
    type: 'journal-article',
    'publication-date': year ? { year: { value: year } } : null,
    'external-ids': doi
      ? {
          'external-id': [
            {
              'external-id-type': 'doi',
              'external-id-value': doi,
              'external-id-relationship': 'self',
            },
          ],
        }
      : null,
  };
}

test('keeps preferred public summaries, deduplicates DOI, and sorts dated works first', () => {
  const outputs = normalizeOrcidWorks({
    group: [
      { 'work-summary': [summary(1, 'Older', '10.1234/older', '2020')] },
      {
        'work-summary': [
          summary(2, 'Duplicate', 'https://doi.org/10.1234/OLDER', '2021'),
        ],
      },
      {
        'work-summary': [
          summary(3, 'Newest', undefined, '2025'),
          summary(4, 'Private'),
        ].map((item, index) =>
          index === 1 ? { ...item, visibility: 'private' } : item
        ),
      },
      { 'work-summary': [summary(5, 'Untitled', undefined)] },
    ],
  });
  expect(outputs.map((output) => output.title)).toEqual([
    'Newest',
    'Older',
    'Untitled',
  ]);
  expect(outputs[1]?.doi).toBe('10.1234/older');
});

test('handles empty groups and rejects malformed API bodies', () => {
  expect(normalizeOrcidWorks({ group: [] })).toEqual([]);
  expect(() => normalizeOrcidWorks({ group: 'invalid' })).toThrow();
});

test('deduplicates concurrent public API reads and caches successful empty results', async () => {
  const request = spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json({ group: [] })) as unknown as typeof fetch);
  const [first, second] = await Promise.all([
    getOrcidWorks('0000-0002-1825-0097'),
    getOrcidWorks('0000-0002-1825-0097'),
  ]);
  expect(first).toEqual([]);
  expect(second).toEqual([]);
  expect(await getOrcidWorks('0000-0002-1825-0097')).toEqual([]);
  expect(request).toHaveBeenCalledTimes(1);
});

test('a temporary API failure does not turn into a cached empty result', async () => {
  const request = spyOn(globalThis, 'fetch').mockImplementationOnce(
    (async () => new Response(null, { status: 429 })) as unknown as typeof fetch
  );
  await expect(getOrcidWorks('0000-0002-1694-233X')).rejects.toThrow();
  request.mockImplementation((async () =>
    Response.json({ group: [] })) as unknown as typeof fetch);
  expect(await getOrcidWorks('0000-0002-1694-233X')).toEqual([]);
  expect(request).toHaveBeenCalledTimes(2);
});
