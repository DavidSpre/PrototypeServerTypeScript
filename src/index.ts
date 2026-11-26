import { app } from './app.mts';
import { createHttp2Server } from './http/server.mts';
import { getPool } from './db/pool.mts';

const port = 3000;
const databasePool = getPool();
databasePool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});
const server = await createHttp2Server(app.fetch, port);
server.on('error', (error) => {
  console.error('Unexpected HTTP/2 server error', error);
});
server.listen(port);
