export type PageSearchParams = Record<string, string | string[] | undefined>;

const HISTORY_PARAM = 'pageHistory';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseHistory(value: string | undefined): Array<string | null> {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length <= 100 &&
      parsed.every((entry) => entry === null || typeof entry === 'string')
    ) {
      return parsed;
    }
  } catch {
    return [];
  }

  return [];
}

function copySearchParams(searchParams: PageSearchParams): URLSearchParams {
  const result = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'cursor' || key === HISTORY_PARAM || value === undefined) {
      continue;
    }

    for (const item of Array.isArray(value) ? value : [value]) {
      result.append(key, item);
    }
  }

  return result;
}

function pageHref(
  pathname: string,
  searchParams: PageSearchParams,
  cursor: string | null,
  history: Array<string | null>
): string {
  const query = copySearchParams(searchParams);
  if (cursor) query.set('cursor', cursor);
  if (history.length > 0) query.set(HISTORY_PARAM, JSON.stringify(history));

  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function getPageNavigation(input: {
  pathname: string;
  searchParams: PageSearchParams;
  nextCursor: string | null;
}): {
  cursor?: string;
  previousHref?: string;
  nextHref?: string;
} {
  const cursor = first(input.searchParams.cursor);
  const history = parseHistory(first(input.searchParams[HISTORY_PARAM]));
  const previousCursor = history.at(-1);
  const previousHref =
    cursor && history.length > 0
      ? pageHref(
          input.pathname,
          input.searchParams,
          previousCursor ?? null,
          history.slice(0, -1)
        )
      : undefined;
  const nextHref = input.nextCursor
    ? pageHref(input.pathname, input.searchParams, input.nextCursor, [
        ...history,
        cursor ?? null,
      ])
    : undefined;

  return { cursor, previousHref, nextHref };
}
