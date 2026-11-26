import { app } from './app.mts';
import { getPool } from './db/pool.mts';
import { serve } from '@hono/node-server';

const port = 3000;
const databasePool = getPool();
databasePool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});
serve({ fetch: app.fetch, port });
