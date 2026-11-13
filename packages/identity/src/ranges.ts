export interface HonoursSelection {
  identifiers: string[];
  excluded: string[];
}

function parseExpression(
  batch: string,
  expression: string,
  maximum: number
): Set<string> {
  const result = new Set<string>();
  if (!expression.trim()) return result;
  const parts = expression.split(/[,\n]/);
  for (const part of parts) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    const range = /^(\d{3})\s*-\s*(\d{3})$/.exec(token);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end) throw new Error(`Reversed range: ${part.trim()}`);
      for (let index = start; index <= end; index += 1) {
        result.add(`${batch}${String(index).padStart(3, '0')}`);
        if (result.size > maximum) throw new Error('Selection exceeds limit');
      }
      continue;
    }
    const identifier = /^(?:s\d{2})?(sp)?(\d{3})$/.exec(token);
    if (
      !identifier ||
      (token.startsWith('s') &&
        !token.startsWith('sp') &&
        !token.startsWith(batch))
    ) {
      throw new Error(`Invalid student identifier: ${part.trim()}`);
    }
    result.add(`${batch}${identifier[1] ?? ''}${identifier[2]}`);
    if (result.size > maximum) throw new Error('Selection exceeds limit');
  }
  return result;
}

export function parseHonoursSelection(input: {
  batch: string;
  include: string;
  exclude?: string;
  additional?: string;
  maximum?: number;
}): HonoursSelection {
  const batch = input.batch.trim().toLowerCase();
  if (!/^s\d{2}$/.test(batch)) throw new Error('Invalid student batch');
  const maximum = input.maximum ?? 500;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1000) {
    throw new Error('Invalid expansion limit');
  }
  const included = parseExpression(batch, input.include, maximum);
  const excluded = parseExpression(batch, input.exclude ?? '', maximum);
  const additional = parseExpression(batch, input.additional ?? '', maximum);
  for (const identifier of excluded) included.delete(identifier);
  for (const identifier of additional) included.add(identifier);
  if (included.size > maximum) throw new Error('Selection exceeds limit');
  if (included.size === 0) throw new Error('Selection is empty');
  return {
    identifiers: [...included].sort(),
    excluded: [...excluded].sort(),
  };
}
