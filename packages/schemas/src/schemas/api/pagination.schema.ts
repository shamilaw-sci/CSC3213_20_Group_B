import { z } from 'zod';

const OPAQUE_CURSOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~:-]*$/;

export const OpaqueCursorSchema = z
  .string()
  .trim()
  .min(16)
  .max(512)
  .regex(OPAQUE_CURSOR_PATTERN);

export const PageLimitSchema = z.coerce.number().int().min(1).max(100);

export const PaginationRequestSchema = z
  .object({
    cursor: OpaqueCursorSchema.optional(),
    limit: PageLimitSchema.default(25),
  })
  .strict();

export const PageInfoSchema = z
  .object({
    nextCursor: OpaqueCursorSchema.nullable(),
    hasMore: z.boolean(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (page) => page.hasMore === (page.nextCursor !== null),
    'hasMore must match the presence of nextCursor'
  );

export function createPageSchema<TItem extends z.ZodType>(itemSchema: TItem) {
  return z
    .object({
      version: z.literal(1),
      items: z.array(itemSchema),
      page: PageInfoSchema,
    })
    .strict();
}

export type OpaqueCursor = z.infer<typeof OpaqueCursorSchema>;
export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;
export type PageInfo = z.infer<typeof PageInfoSchema>;
export type Page<TItem> = {
  version: 1;
  items: TItem[];
  page: PageInfo;
};
