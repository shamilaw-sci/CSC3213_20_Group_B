const identityTables = new Set([
  'identity_review',
  'identity_audit',
  'honours_operation_history',
]);

/** Only identify absent tables introduced by the identity migration. */
export function isIdentityMigrationMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = 'code' in error ? error.code : undefined;
  if (
    code !== 'SQLITE_ERROR' &&
    code !== '42P01' &&
    code !== 'D1_ERROR' &&
    !error.message.startsWith('D1_ERROR:')
  )
    return false;
  const match = /(?:no such table:|relation )\s*["']?([a-z_]+)["']?/i.exec(
    error.message
  );
  return match ? identityTables.has(match[1] ?? '') : false;
}
