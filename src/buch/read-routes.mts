import { type Context, Hono } from 'hono';
import { notFound, parseId, sendConditionalJson, toBook, validationProblem } from './http.mts';
import { type BookDatabase } from './types.mts';
import { bookQuerySchema } from './validation.mts';

const BAD_REQUEST = 400;

const listBooks = async (c: Context, database: BookDatabase) => {
  const parsed = bookQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return validationProblem(c, parsed.error.issues, BAD_REQUEST);
  }

  const books = await database.listBooks(parsed.data);
  return sendConditionalJson(c, books.map(toBook));
};

const getBook = async (c: Context, database: BookDatabase) => {
  const id = parseId(c);
  if (id instanceof Response) {
    return id;
  }

  const book = await database.findBookById(id);
  return book === undefined ? notFound(c) : sendConditionalJson(c, toBook(book));
};

export const registerBookReadRoutes = (router: Hono, database: BookDatabase): void => {
  router.get('/', (c) => listBooks(c, database));
  router.get('/:id', (c) => getBook(c, database));
};
