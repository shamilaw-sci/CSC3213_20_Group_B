import { z } from 'zod';

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Registry identifiers are lowercase kebab-case segments. Keeping the pattern
 * in one place prevents course, offering, project, and record ids from
 * drifting apart.
 */
export function createKebabCaseIdSchema(message: string) {
  return z.string().trim().min(1).regex(KEBAB_CASE_PATTERN, message);
}
