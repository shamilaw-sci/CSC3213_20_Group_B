export function isGitHubNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  );
}

/**
 * GitHub returns 422, not 404, when updateRef targets a missing branch.
 */
export function isGitHubMissingRefError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 422 &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('reference does not exist')
  );
}
