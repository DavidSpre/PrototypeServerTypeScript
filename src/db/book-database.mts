import { type BookDatabase, type BookRow } from '../buch/types.mts';
import { getPool } from './pool.mts';

export const bookDatabase: BookDatabase = {
  query: async (statement, values) => {
    const result = await getPool().query<BookRow>(statement, values);
    return { rows: result.rows };
  },
};
