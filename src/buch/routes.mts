import { type BookDatabase } from './types.mts';
import { Hono } from 'hono';
import { bookDatabase } from '../db/book-database.mts';
import { registerBookReadRoutes } from './read-routes.mts';
import { registerBookWriteRoutes } from './write-routes.mts';

export const createBookRoutes = (database: BookDatabase = bookDatabase): Hono => {
  const router = new Hono();
  registerBookReadRoutes(router, database);
  registerBookWriteRoutes(router, database);
  return router;
};
