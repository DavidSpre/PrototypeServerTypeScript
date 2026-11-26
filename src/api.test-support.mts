import { type BookDatabase, type BookRow } from './buch/types.mts';
import { type MiddlewareHandler } from 'hono';
import { createApp } from './app.mts';

type JsonBody = { type?: string; status?: number; errors?: unknown; version?: number };

export const isJsonObject = (value: unknown): value is JsonBody => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return (
    (!('type' in value) || typeof value.type === 'string') &&
    (!('status' in value) || typeof value.status === 'number') &&
    (!('version' in value) || typeof value.version === 'number')
  );
};

export const readJsonObject = async (response: Response): Promise<JsonBody> => {
  const body: unknown = await response.json();
  if (!isJsonObject(body)) {
    throw new TypeError('Expected a JSON object');
  }
  return body;
};

export const sampleBook: BookRow = {
  id: 1000,
  version: 0,
  isbn: '978-3-897-22583-1',
  rating: 4,
  art: 'EPUB',
  preis: '11.10',
  rabatt: '0.011',
  lieferbar: true,
  datum: '2025-02-01',
  homepage: 'https://example.test',
  schlagwoerter: ['TYPESCRIPT'],
  erzeugt: new Date('2025-02-01T00:00:00.000Z'),
  aktualisiert: new Date('2025-02-01T00:00:00.000Z'),
  titel: null,
  datei: null,
  abbildungen: [],
};

export const emptyDatabase: BookDatabase = {
  listBooks: () => Promise.resolve([]),
  findBookById: () => Promise.resolve(undefined),
  createBook: () => Promise.resolve(undefined),
  updateBookIfVersionMatches: () => Promise.resolve(undefined),
};

const allowTestRequest: MiddlewareHandler = (_context, next) => next();

export const createTestApp = (database: BookDatabase = emptyDatabase) =>
  createApp(database, allowTestRequest);
