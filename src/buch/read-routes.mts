import { type Context, Hono } from 'hono';
import {
  columns,
  notFound,
  parseId,
  sendConditionalJson,
  toBook,
  validationProblem,
} from './http.mts';
import { type BookDatabase } from './types.mts';
import { bookQuerySchema } from './validation.mts';

const BAD_REQUEST = 400;

const listBooks = async (c: Context, database: BookDatabase) => {
  const parsed = bookQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return validationProblem(c, parsed.error.issues, BAD_REQUEST);
  }

  const { limit, offset, isbn, rating, art, lieferbar } = parsed.data;
  const values: unknown[] = [];
  const filters: string[] = [];
  for (const [column, value] of [
    ['isbn', isbn],
    ['rating', rating],
    ['art', art],
    ['lieferbar', lieferbar],
  ] as const) {
    if (value !== undefined) {
      values.push(value);
      filters.push(`"${column}" = $${values.length}`);
    }
  }

  values.push(limit, offset);
  const where = filters.length === 0 ? '' : `WHERE ${filters.join(' AND ')}`;
  const limitPosition = values.length - 1;
  const result = await database.query(
    `SELECT ${columns} FROM "buch"."buch" ${where} ORDER BY "id" LIMIT $${limitPosition} OFFSET $${values.length}`,
    values,
  );
  return sendConditionalJson(c, result.rows.map(toBook));
};

const getBook = async (c: Context, database: BookDatabase) => {
  const id = parseId(c);
  if (id instanceof Response) {
    return id;
  }

  const result = await database.query(`SELECT ${columns} FROM "buch"."buch" WHERE "id" = $1`, [id]);
  const [row] = result.rows;
  return row === undefined ? notFound(c) : sendConditionalJson(c, toBook(row));
};

export const registerBookReadRoutes = (router: Hono, database: BookDatabase): void => {
  router.get('/', (c) => listBooks(c, database));
  router.get('/:id', (c) => getBook(c, database));
};
