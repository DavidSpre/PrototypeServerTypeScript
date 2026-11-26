import { createTestApp, emptyDatabase, readJsonObject, sampleBook } from './api.test-support.mts';
import { type BookDatabase } from './buch/types.mts';
import { type PatchBook } from './buch/validation.mts';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const BOOK_ID = 1000;
const RATING = 4;
const UPDATED_RATING = 5;
const PAGE_LIMIT = 10;
const PAGE_OFFSET = 2;
const CONFLICT = 409;

test('GET book responses include an ETag and honor If-None-Match', async () => {
  const database: BookDatabase = {
    ...emptyDatabase,
    findBookById: () => Promise.resolve(sampleBook),
  };
  const api = createTestApp(database);
  const firstResponse = await api.request('/api/buecher/1000');
  const etag = firstResponse.headers.get('ETag');

  assert.ok(etag);
  assert.equal(firstResponse.status, 200);

  const cachedResponse = await api.request('/api/buecher/1000', {
    headers: { 'If-None-Match': etag },
  });
  assert.equal(cachedResponse.status, 304);
  assert.equal(cachedResponse.headers.get('ETag'), etag);
});

test('GET query parameters become database filters and pagination', async () => {
  let filters: Parameters<BookDatabase['listBooks']>[0] | undefined;
  const database: BookDatabase = {
    ...emptyDatabase,
    listBooks: (parameters) => {
      filters = parameters;
      return Promise.resolve([]);
    },
  };
  const api = createTestApp(database);
  const response = await api.request(
    `/api/buecher?isbn=978-3-897-22583-1&rating=${RATING}&art=EPUB&lieferbar=true&limit=${PAGE_LIMIT}&offset=${PAGE_OFFSET}`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(filters, {
    isbn: '978-3-897-22583-1',
    rating: RATING,
    art: 'EPUB',
    lieferbar: true,
    limit: PAGE_LIMIT,
    offset: PAGE_OFFSET,
  });
});

test('POST creates a book and returns its Location and ETag', async () => {
  const database: BookDatabase = {
    ...emptyDatabase,
    createBook: () => Promise.resolve(sampleBook),
  };
  const api = createTestApp(database);
  const response = await api.request('/api/buecher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      isbn: sampleBook.isbn,
      rating: RATING,
      preis: 11.1,
      rabatt: 0.011,
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Location'), `/api/buecher/${BOOK_ID}`);
  assert.ok(response.headers.get('ETag'));
});

test('duplicate ISBN errors use Problem Details with a conflict status', async () => {
  const duplicateError = Object.assign(new Error('duplicate ISBN'), { code: '23505' });
  const database: BookDatabase = {
    ...emptyDatabase,
    createBook: () => Promise.reject(duplicateError),
  };
  const api = createTestApp(database);
  const response = await api.request('/api/buecher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      isbn: sampleBook.isbn,
      rating: RATING,
      preis: 11.1,
      rabatt: 0.011,
    }),
  });
  const body = await readJsonObject(response);

  assert.equal(response.status, CONFLICT);
  assert.equal(response.headers.get('Content-Type'), 'application/problem+json');
  assert.equal(body.status, CONFLICT);
});

test('PATCH persists the expected row version and returns the updated resource', async () => {
  const updatedBook = {
    ...sampleBook,
    version: 1,
    rating: UPDATED_RATING,
    aktualisiert: new Date('2025-02-02T00:00:00.000Z'),
  };
  let updatedId = 0;
  let expectedVersion = -1;
  let updateFields: PatchBook | undefined;
  const database: BookDatabase = {
    ...emptyDatabase,
    findBookById: () => Promise.resolve(sampleBook),
    updateBookIfVersionMatches: (id, version, fields) => {
      updatedId = id;
      expectedVersion = version;
      updateFields = fields;
      return Promise.resolve(updatedBook);
    },
  };
  const api = createTestApp(database);
  const getResponse = await api.request(`/api/buecher/${BOOK_ID}`);
  const etag = getResponse.headers.get('ETag');
  assert.ok(etag);

  const response = await api.request(`/api/buecher/${BOOK_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify({ rating: UPDATED_RATING }),
  });
  const body = await readJsonObject(response);

  assert.equal(response.status, 200);
  assert.equal(body.version, 1);
  assert.equal(updatedId, BOOK_ID);
  assert.equal(expectedVersion, 0);
  assert.deepEqual(updateFields, { rating: UPDATED_RATING });
});

test('PATCH rejects a stale If-Match without updating the resource', async () => {
  let updateAttempted = false;
  const database: BookDatabase = {
    ...emptyDatabase,
    findBookById: () => Promise.resolve(sampleBook),
    updateBookIfVersionMatches: () => {
      updateAttempted = true;
      return Promise.resolve(undefined);
    },
  };
  const api = createTestApp(database);
  const response = await api.request(`/api/buecher/${BOOK_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': '"stale"' },
    body: JSON.stringify({ rating: UPDATED_RATING }),
  });

  assert.equal(response.status, 412);
  assert.equal(updateAttempted, false);
});
