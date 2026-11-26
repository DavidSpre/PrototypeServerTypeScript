import { Hono, type MiddlewareHandler } from 'hono';
import { type BookDatabase } from './types.mts';
import { bookDatabase } from '../db/book-database.mts';
import { registerBookReadRoutes } from './read-routes.mts';
import { registerBookWriteRoutes } from './write-routes.mts';
import { requireKeycloakRole } from '../auth/keycloak.mts';

export const createBookRoutes = (
  database: BookDatabase = bookDatabase,
  createBookAuthorization: MiddlewareHandler = requireKeycloakRole({ role: 'user' }),
): Hono => {
  const router = new Hono();
  registerBookReadRoutes(router, database);
  registerBookWriteRoutes(router, database, createBookAuthorization);
  return router;
};
