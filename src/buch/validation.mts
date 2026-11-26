import { z } from 'zod';

const PRICE_DECIMAL_PLACES = 2;
const DISCOUNT_DECIMAL_PLACES = 3;
const MAX_PRICE = 999999.99;
const MAX_DISCOUNT = 9.999;
const MAX_TEXT_LENGTH = 32;
const MAX_RATING = 5;
const MAX_POSTGRES_INTEGER = 2_147_483_647;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

const bookArtSchema = z.enum(['EPUB', 'HARDCOVER', 'PAPERBACK']);
const moneySchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_PRICE)
  .refine(
    (value) => Number(value.toFixed(PRICE_DECIMAL_PLACES)) === value,
    `Must have at most ${PRICE_DECIMAL_PLACES} decimal places`,
  );
const discountSchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_DISCOUNT)
  .refine(
    (value) => Number(value.toFixed(DISCOUNT_DECIMAL_PLACES)) === value,
    `Must have at most ${DISCOUNT_DECIMAL_PLACES} decimal places`,
  );

export const createBookSchema = z.strictObject({
  isbn: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  rating: z.number().int().min(0).max(MAX_RATING),
  art: bookArtSchema.nullable().optional(),
  preis: moneySchema,
  rabatt: discountSchema,
  lieferbar: z.boolean().optional(),
  datum: z.iso.date().nullable().optional(),
  homepage: z.string().nullable().optional(),
  schlagwoerter: z.json().nullable().optional(),
});

export const replaceBookSchema = createBookSchema.extend({
  art: bookArtSchema.nullable(),
  lieferbar: z.boolean(),
  datum: z.iso.date().nullable(),
  homepage: z.string().nullable(),
  schlagwoerter: z.json().nullable(),
});

export const patchBookSchema = createBookSchema
  .partial()
  .refine((book) => Object.keys(book).length > 0, 'At least one field must be provided');

export const bookIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/u)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_POSTGRES_INTEGER));

const limitSchema = z
  .string()
  .regex(/^[1-9]\d*$/u)
  .transform(Number)
  .pipe(z.number().int().max(MAX_PAGE_SIZE))
  .optional()
  .transform((value) => value ?? DEFAULT_PAGE_SIZE);
const offsetSchema = z
  .string()
  .regex(/^\d+$/u)
  .transform(Number)
  .pipe(z.number().int().max(MAX_POSTGRES_INTEGER))
  .optional()
  .transform((value) => value ?? 0);

export const bookQuerySchema = z.object({
  limit: limitSchema,
  offset: offsetSchema,
  isbn: z.string().trim().min(1).max(MAX_TEXT_LENGTH).optional(),
  rating: z
    .string()
    .regex(/^[0-5]$/u)
    .transform(Number)
    .optional(),
  art: bookArtSchema.optional(),
  lieferbar: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type CreateBook = z.output<typeof createBookSchema>;
export type ReplaceBook = z.output<typeof replaceBookSchema>;
export type PatchBook = z.output<typeof patchBookSchema>;
