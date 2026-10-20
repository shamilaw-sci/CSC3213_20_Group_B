export function normalizeAcademicId(id: string): string {
  return id.trim().toLowerCase();
}

function isAcademicRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function byDisplayName(
  left: Record<string, unknown>,
  right: Record<string, unknown>
): number {
  return String(left.title ?? left.id).localeCompare(
    String(right.title ?? right.id)
  );
}

export function upsertAcademicRecord(
  existingValue: unknown,
  record: Record<string, unknown>
): Record<string, unknown>[] {
  const id = typeof record.id === 'string' ? record.id : '';
  const records = Array.isArray(existingValue) ? existingValue : [];
  const nextRecords = records.filter(
    (item): item is Record<string, unknown> =>
      isAcademicRecord(item) && item.id !== id
  );
  nextRecords.push(record);
  return nextRecords.sort(byDisplayName);
}

export function removeAcademicRecord(
  existingValue: unknown,
  id: string
): Record<string, unknown>[] {
  const normalizedId = normalizeAcademicId(id);
  const records = Array.isArray(existingValue) ? existingValue : [];
  return records
    .filter(
      (item): item is Record<string, unknown> =>
        isAcademicRecord(item) && item.id !== normalizedId
    )
    .sort(byDisplayName);
}
