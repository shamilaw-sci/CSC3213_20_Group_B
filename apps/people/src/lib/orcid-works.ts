import { normalizeOrcidIdentifier } from '@scs/schemas';
import { z } from 'zod';

const ValueSchema = z
  .object({ value: z.string().nullable().optional() })
  .nullable()
  .optional();
const ExternalIdSchema = z.object({
  'external-id-type': z.string().nullable().optional(),
  'external-id-value': z.string().nullable().optional(),
  'external-id-normalized': ValueSchema,
  'external-id-relationship': z.string().nullable().optional(),
});
const ExternalIdsSchema = z
  .object({ 'external-id': z.array(ExternalIdSchema).nullable().optional() })
  .nullable()
  .optional();
const SummarySchema = z.object({
  'put-code': z.number().int(),
  'display-index': z.string().nullable().optional(),
  visibility: z.string().nullable().optional(),
  title: z.object({ title: ValueSchema }).nullable().optional(),
  type: z.string().nullable().optional(),
  'publication-date': z
    .object({ year: ValueSchema, month: ValueSchema, day: ValueSchema })
    .nullable()
    .optional(),
  'journal-title': ValueSchema,
  url: ValueSchema,
  'external-ids': ExternalIdsSchema,
});
const WorksSchema = z.object({
  group: z
    .array(
      z.object({
        'work-summary': z.array(SummarySchema).nullable().optional(),
        'external-ids': ExternalIdsSchema,
      })
    )
    .max(1000)
    .nullable()
    .optional(),
});

export interface ResearchOutput {
  id: number;
  title: string;
  type?: string;
  date?: string;
  venue?: string;
  doi?: string;
  url?: string;
}

function safeUrl(value: string | null | undefined): string | undefined {
  if (!value || !URL.canParse(value)) return;
  const url = new URL(value);
  return url.protocol === 'https:' || url.protocol === 'http:'
    ? url.toString()
    : undefined;
}

function doiFrom(ids: z.infer<typeof ExternalIdsSchema>): string | undefined {
  for (const id of ids?.['external-id'] ?? []) {
    if (
      id['external-id-type']?.toLowerCase() !== 'doi' ||
      id['external-id-relationship'] === 'part-of'
    )
      continue;
    const doi = (
      id['external-id-normalized']?.value ??
      id['external-id-value'] ??
      ''
    )
      .trim()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .toLowerCase();
    if (/^10\.\d{4,9}\/\S+$/.test(doi)) return doi;
  }
}

function publicationDate(
  date: z.infer<typeof SummarySchema>['publication-date']
): string | undefined {
  const year = date?.year?.value;
  if (!year || !/^\d{4}$/.test(year)) return;
  const month = date?.month?.value;
  if (!month || !/^(?:[1-9]|1[0-2]|0[1-9])$/.test(month)) return year;
  const day = date?.day?.value;
  if (!day || !/^(?:[1-9]|[12]\d|3[01]|0[1-9])$/.test(day))
    return `${year}-${month.padStart(2, '0')}`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function normalizeOrcidWorks(input: unknown): ResearchOutput[] {
  const parsed = WorksSchema.parse(input);
  const seenDois = new Set<string>();
  const outputs: ResearchOutput[] = [];
  for (const group of parsed.group ?? []) {
    const preferred = [...(group['work-summary'] ?? [])]
      .filter(
        (summary) =>
          summary.visibility === 'public' && summary.title?.title?.value?.trim()
      )
      .sort(
        (a, b) =>
          Number(a['display-index'] ?? Infinity) -
          Number(b['display-index'] ?? Infinity)
      )[0];
    if (!preferred) continue;
    const doi =
      doiFrom(preferred['external-ids']) ?? doiFrom(group['external-ids']);
    if (doi && seenDois.has(doi)) continue;
    if (doi) seenDois.add(doi);
    const date = publicationDate(preferred['publication-date']);
    outputs.push({
      id: preferred['put-code'],
      title: preferred.title!.title!.value!.trim(),
      ...(preferred.type ? { type: preferred.type.replace(/-/g, ' ') } : {}),
      ...(date ? { date } : {}),
      ...(preferred['journal-title']?.value
        ? { venue: preferred['journal-title'].value }
        : {}),
      ...(doi ? { doi } : {}),
      ...(safeUrl(preferred.url?.value)
        ? { url: safeUrl(preferred.url?.value) }
        : {}),
    });
  }
  return outputs.sort(
    (a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '') ||
      a.title.localeCompare(b.title)
  );
}

const cache = new Map<string, { expires: number; value: ResearchOutput[] }>();
const inFlight = new Map<string, Promise<ResearchOutput[]>>();

export async function getOrcidWorks(
  identifier: string
): Promise<ResearchOutput[]> {
  const canonical = normalizeOrcidIdentifier(identifier);
  if (!canonical) throw new Error('Invalid ORCID identifier');
  const existing = cache.get(canonical);
  if (existing && existing.expires > Date.now()) return existing.value;
  const pending = inFlight.get(canonical);
  if (pending) return pending;
  const request = (async () => {
    try {
      const response = await fetch(
        `https://pub.orcid.org/v3.0/${canonical}/works`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        }
      );
      if (!response.ok) throw new Error(`ORCID returned ${response.status}`);
      const normalized = normalizeOrcidWorks(await response.json());
      cache.set(canonical, {
        expires: Date.now() + 60 * 60 * 1000,
        value: normalized,
      });
      return normalized;
    } catch (error) {
      if (existing) return existing.value;
      throw error;
    } finally {
      inFlight.delete(canonical);
    }
  })();
  inFlight.set(canonical, request);
  return request;
}
