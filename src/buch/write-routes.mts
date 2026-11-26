import { type Context, Hono } from 'hono';
import {
  type PatchBook,
  createBookSchema,
  patchBookSchema,
  replaceBookSchema,
} from './validation.mts';
import {
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
  const created = await database.createBook(book);
  if (created === undefined) {
    throw new Error('The database did not return the inserted book');
  }

  const responseBook = toBook(created);
  c.header('Location', `/api/buecher/${responseBook.id}`);
  c.header('ETag', createEntityTag(responseBook));
  return c.json(responseBook, 201);
};

const updateBook = async (
  c: Context,
  id: number,
  { database, tags, fields }: UpdateInput,
): Promise<Response> => {
  const current = await database.findBookById(id);
  if (current === undefined) {
    return notFound(c);
  }

  const currentBook = toBook(current);
  if (!strongTagMatches(tags, createEntityTag(currentBook))) {
    return preconditionFailed(c);
  }

  const updated = await database.updateBookIfVersionMatches(id, current.version, fields);
  return updated === undefined ? preconditionFailed(c) : sendJsonWithEtag(c, toBook(updated));
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
