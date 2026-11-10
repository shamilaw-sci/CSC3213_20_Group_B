/** Shallow narrowing for unknown JSON values; domain validation stays at its boundary. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
