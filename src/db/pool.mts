// oxlint-disable-next-line import/no-unassigned-import
import 'dotenv/config';
import { Pool } from 'pg';
import process from 'node:process';

let pool: Pool | undefined;

export const getPool = (): Pool => {
  if (pool !== undefined) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not set');
  }
  pool = new Pool({ connectionString: databaseUrl });
  return pool;
};
