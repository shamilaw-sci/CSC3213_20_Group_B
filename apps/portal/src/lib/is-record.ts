/** Shallow narrowing for flexible editor values and legacy JSON responses. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
