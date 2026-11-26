import { Hono, type MiddlewareHandler } from 'hono';
import { type BookDatabase } from './buch/types.mts';
import { HTTPException } from 'hono/http-exception';
import { bookDatabase } from './db/book-database.mts';
import { createBookRoutes } from './buch/routes.mts';
import { problemResponse } from './api/problem.mts';
import { requireKeycloakRole } from './auth/keycloak.mts';

const BAD_REQUEST = 400;

const isDatabaseCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code;

export const createApp = (
  database: BookDatabase = bookDatabase,
  createBookAuthorization: MiddlewareHandler = requireKeycloakRole({ role: 'user' }),
): Hono => {
  const application = new Hono();

  application.get('/', (c) => c.text('Hello Hono!'));
  application.route('/api/buecher', createBookRoutes(database, createBookAuthorization));

  application.notFound((c) =>
    problemResponse({
      status: 404,
      title: 'Not Found',
      detail: 'The requested endpoint does not exist.',
      instance: c.req.path,
    }),
  );

  // oxlint-disable-next-line promise/prefer-await-to-callbacks
  application.onError((error, c) => {
    if (error instanceof HTTPException && error.status < 500) {
      return problemResponse({
        status: error.status,
        title: error.status === BAD_REQUEST ? 'Bad Request' : 'Request Error',
        detail: 'The request could not be parsed.',
        instance: c.req.path,
      });
    }
    if (isDatabaseCode(error, '23505')) {
      return problemResponse({
        status: 409,
        title: 'Conflict',
        detail: 'A book with this ISBN already exists.',
        instance: c.req.path,
      });
    }
    if (isDatabaseCode(error, '23514')) {
      return problemResponse({
        status: 422,
        title: 'Unprocessable Content',
        detail: 'The submitted book violates a data constraint.',
        instance: c.req.path,
      });
    }

    console.error('Unhandled API error', error);
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: 'An unexpected error occurred.',
      instance: c.req.path,
    });
  });

  return application;
};

export const app = createApp();
