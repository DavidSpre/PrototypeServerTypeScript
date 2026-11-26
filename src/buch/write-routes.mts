import { type Context, Hono } from 'hono';
import {
  type PatchBook,
  createBookSchema,
  patchBookSchema,
  replaceBookSchema,
} from './validation.mts';
import {
  columns,
  invalidJsonProblem,
  notFound,
  parseId,
  parseIfMatch,
  preconditionFailed,
  requireJson,
  sendJsonWithEtag,
  strongTagMatches,
  toBook,
  validationProblem,
} from './http.mts';
import { type BookDatabase } from './types.mts';
import { createEntityTag } from '../http/entity-tag.mts';
import { z } from 'zod';

type UpdateInput = { database: BookDatabase; tags: string[]; fields: PatchBook };
type BodyResult<Output> = { data: Output } | { response: Response };

const validateJson = async <Schema extends z.ZodType>(
  c: Context,
  schema: Schema,
): Promise<BodyResult<z.output<Schema>>> => {
  const mediaTypeError = requireJson(c);
  if (mediaTypeError !== null) {
    return { response: mediaTypeError };
  }

  let requestBody: unknown;
  try {
    requestBody = await c.req.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { response: invalidJsonProblem(c) };
    }
    throw error;
  }

  const parsed = schema.safeParse(requestBody);
  return parsed.success
    ? { data: parsed.data }
    : { response: validationProblem(c, parsed.error.issues) };
};

const createBook = async (c: Context, database: BookDatabase) => {
  const body = await validateJson(c, createBookSchema);
  if ('response' in body) {
    return body.response;
  }

  const book = body.data;
  const result = await database.query(
    `INSERT INTO "buch"."buch" ("isbn", "rating", "art", "preis", "rabatt", "lieferbar", "datum", "homepage", "schlagwoerter")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${columns}`,
    [
      book.isbn,
      book.rating,
      book.art ?? null,
      book.preis,
      book.rabatt,
      book.lieferbar ?? false,
      book.datum ?? null,
      book.homepage ?? null,
      book.schlagwoerter ?? null,
    ],
  );
  const [row] = result.rows;
  if (row === undefined) {
    throw new Error('The database did not return the inserted book');
  }

  const created = toBook(row);
  c.header('Location', `/api/buecher/${created.id}`);
  c.header('ETag', createEntityTag(created));
  return c.json(created, 201);
};

const updateBook = async (
  c: Context,
  id: number,
  { database, tags, fields }: UpdateInput,
): Promise<Response> => {
  const currentResult = await database.query(
    `SELECT ${columns} FROM "buch"."buch" WHERE "id" = $1`,
    [id],
  );
  const [currentRow] = currentResult.rows;
  if (currentRow === undefined) {
    return notFound(c);
  }

  const currentBook = toBook(currentRow);
  if (!strongTagMatches(tags, createEntityTag(currentBook))) {
    return preconditionFailed(c);
  }

  const values: unknown[] = [];
  const assignments: string[] = [];
  for (const field of [
    'isbn',
    'rating',
    'art',
    'preis',
    'rabatt',
    'lieferbar',
    'datum',
    'homepage',
    'schlagwoerter',
  ] as const) {
    if (Object.hasOwn(fields, field)) {
      values.push(fields[field]);
      assignments.push(`"${field}" = $${values.length}`);
    }
  }
  assignments.push('"version" = "version" + 1', '"aktualisiert" = now()');
  values.push(id, currentRow.version);

  const idPosition = values.length - 1;
  const versionPosition = values.length;
  const result = await database.query(
    `UPDATE "buch"."buch" SET ${assignments.join(', ')} WHERE "id" = $${idPosition} AND "version" = $${versionPosition} RETURNING ${columns}`,
    values,
  );
  const [updatedRow] = result.rows;
  return updatedRow === undefined ? preconditionFailed(c) : sendJsonWithEtag(c, toBook(updatedRow));
};

const putBook = async (c: Context, database: BookDatabase) => {
  const id = parseId(c);
  if (id instanceof Response) {
    return id;
  }
  const tags = parseIfMatch(c);
  if (tags instanceof Response) {
    return tags;
  }
  const body = await validateJson(c, replaceBookSchema);
  if ('response' in body) {
    return body.response;
  }
  return updateBook(c, id, { database, tags, fields: body.data });
};

const patchBook = async (c: Context, database: BookDatabase) => {
  const id = parseId(c);
  if (id instanceof Response) {
    return id;
  }
  const tags = parseIfMatch(c);
  if (tags instanceof Response) {
    return tags;
  }
  const body = await validateJson(c, patchBookSchema);
  if ('response' in body) {
    return body.response;
  }
  return updateBook(c, id, { database, tags, fields: body.data });
};

export const registerBookWriteRoutes = (router: Hono, database: BookDatabase): void => {
  router.post('/', (c) => createBook(c, database));
  router.put('/:id', (c) => putBook(c, database));
  router.patch('/:id', (c) => patchBook(c, database));
};
