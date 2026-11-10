import { z } from 'zod';

/** GitHub file content can be a legacy record with fields outside current domain schemas. */
export const JsonRecordSchema = z.record(z.string(), z.unknown());
