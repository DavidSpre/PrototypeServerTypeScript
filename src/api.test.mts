import { type BookDatabase, type BookRow } from './buch/types.mts';
import { matchesIfNoneMatch, parseEntityTags } from './http/entity-tag.mts';
import assert from 'node:assert/strict';
import { createApp } from './app.mts';
import { test } from 'node:test';

const BAD_REQUEST = 400;
const CONFLICT = 409;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UNPROCESSABLE_CONTENT = 422;
const BOOK_ID = 1000;
const RATING = 4;
const UPDATED_RATING = 5;
const PAGE_LIMIT = 10;
const PAGE_OFFSET = 2;
const sampleBook: BookRow = {
  id: BOOK_ID,
  version: 0,
  isbn: '978-3-897-22583-1',
  rating: RATING,
  art: 'EPUB',
  preis: '11.10',
  rabatt: '0.011',
  lieferbar: true,
  datum: '2025-02-01',
  homepage: 'https://example.test',
  schlagwoerter: ['TYPESCRIPT'],
  erzeugt: new Date('2025-02-01T00:00:00.000Z'),
  aktualisiert: new Date('2025-02-01T00:00:00.000Z'),
};
const emptyDatabase: BookDatabase = { query: () => Promise.resolve({ rows: [] }) };
const testApp = createApp(emptyDatabase);

test('book routes return Problem Details for invalid path parameters', async () => {
  const response = await testApp.request('/api/buecher/not-an-id');
  const body = await response.json();

  assert.equal(response.status, BAD_REQUEST);
  assert.equal(response.headers.get('Content-Type'), 'application/problem+json');
  assert.equal(body.type, 'about:blank');
  assert.equal(body.status, BAD_REQUEST);
});

test('book routes validate JSON bodies with Zod', async () => {
  const response = await testApp.request('/api/buecher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isbn: '', rating: 7, preis: -1, rabatt: 0 }),
  });
  const body = await response.json();

  assert.equal(response.status, UNPROCESSABLE_CONTENT);
  assert.equal(body.status, UNPROCESSABLE_CONTENT);
  assert.ok(Array.isArray(body.errors));
});

test('book routes reject invalid query parameters before accessing the database', async () => {
  const response = await testApp.request('/api/buecher?rating=7');
  const body = await response.json();

  assert.equal(response.status, BAD_REQUEST);
  assert.equal(body.type, 'about:blank');
});

test('book writes require a JSON content type', async () => {
  const response = await testApp.request('/api/buecher', {
    method: 'POST',
    body: JSON.stringify({ isbn: '9781234567890' }),
  });

  assert.equal(response.status, UNSUPPORTED_MEDIA_TYPE);
  assert.equal(response.headers.get('Content-Type'), 'application/problem+json');
});

test('malformed JSON is returned as Problem Details', async () => {
  const response = await testApp.request('/api/buecher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });

  assert.equal(response.status, BAD_REQUEST);
  assert.equal(response.headers.get('Content-Type'), 'application/problem+json');
});

test('book updates require a strong If-Match validator', async () => {
  const response = await testApp.request('/api/buecher/1000', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 4 }),
  });
  const body = await response.json();

  assert.equal(response.status, 428);
  assert.equal(body.type, 'about:blank');
});

test('PUT requires a complete Zod-validated book representation', async () => {
  const response = await testApp.request('/api/buecher/1000', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': '"current"' },
    body: JSON.stringify({ rating: RATING }),
  });
  const body = await response.json();

  assert.equal(response.status, UNPROCESSABLE_CONTENT);
  assert.ok(Array.isArray(body.errors));
});

test('PATCH rejects an empty object through Zod validation', async () => {
  const response = await testApp.request('/api/buecher/1000', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': '"current"' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, UNPROCESSABLE_CONTENT);
});

test('If-Match wildcard is rejected because it cannot prevent lost updates', async () => {
  const response = await testApp.request('/api/buecher/1000', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': '*' },
    body: JSON.stringify({ rating: 4 }),
  });

  assert.equal(response.status, BAD_REQUEST);
});

test('If-None-Match parsing supports weak validators and commas in tags', () => {
  const tags = parseEntityTags('"opaque,tag", W/"current"');

  assert.deepEqual(tags, ['"opaque,tag"', 'W/"current"']);
  assert.equal(matchesIfNoneMatch(tags ?? [], '"current"'), true);
  assert.equal(parseEntityTags('not-an-etag'), null);
});

test('GET book responses include an ETag and honor If-None-Match', async () => {
  const database: BookDatabase = { query: () => Promise.resolve({ rows: [sampleBook] }) };
  const api = createApp(database);
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

test('GET query parameters become parameterized database filters', async () => {
  let query = '';
  let values: unknown[] = [];
  const database: BookDatabase = {
    query: (statement, parameters) => {
      query = statement;
      values = parameters ?? [];
      return Promise.resolve({ rows: [] });
    },
  };
  const api = createApp(database);
  const response = await api.request(
    `/api/buecher?isbn=978-3-897-22583-1&rating=${RATING}&art=EPUB&lieferbar=true&limit=${PAGE_LIMIT}&offset=${PAGE_OFFSET}`,
  );

  assert.equal(response.status, 200);
  assert.match(query, /"isbn" = \$1/u);
  assert.deepEqual(values, ['978-3-897-22583-1', RATING, 'EPUB', true, PAGE_LIMIT, PAGE_OFFSET]);
});

test('POST creates a book and returns its Location and ETag', async () => {
  const database: BookDatabase = { query: () => Promise.resolve({ rows: [sampleBook] }) };
  const api = createApp(database);
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
  assert.equal(response.headers.get('Location'), '/api/buecher/1000');
  assert.ok(response.headers.get('ETag'));
});

test('duplicate ISBN errors use Problem Details with a conflict status', async () => {
  const duplicateError = Object.assign(new Error('duplicate ISBN'), { code: '23505' });
  const database: BookDatabase = {
    query: () => Promise.reject(duplicateError),
  };
  const api = createApp(database);
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
  const body = await response.json();

  assert.equal(response.status, CONFLICT);
  assert.equal(response.headers.get('Content-Type'), 'application/problem+json');
  assert.equal(body.status, CONFLICT);
});

test('PATCH uses If-Match and atomically increments the row version', async () => {
  const updatedBook = {
    ...sampleBook,
    version: 1,
    rating: UPDATED_RATING,
    aktualisiert: new Date('2025-02-02T00:00:00.000Z'),
  };
  const statements: string[] = [];
  let updateValues: unknown[] = [];
  const database: BookDatabase = {
    query: (statement, values) => {
      statements.push(statement);
      if (statement.startsWith('UPDATE')) {
        updateValues = values ?? [];
        return Promise.resolve({ rows: [updatedBook] });
      }
      return Promise.resolve({ rows: [sampleBook] });
    },
  };
  const api = createApp(database);
  const getResponse = await api.request('/api/buecher/1000');
  const etag = getResponse.headers.get('ETag');
  assert.ok(etag);

  const response = await api.request('/api/buecher/1000', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify({ rating: UPDATED_RATING }),
  });
  const body = await response.json();
  const updateStatement = statements.find((statement) => statement.startsWith('UPDATE'));

  assert.equal(response.status, 200);
  assert.equal(body.version, 1);
  assert.ok(updateStatement);
  assert.match(updateStatement, /"version" = "version" \+ 1/u);
  assert.match(updateStatement, /WHERE "id" = \$2 AND "version" = \$3/u);
  assert.deepEqual(updateValues, [UPDATED_RATING, BOOK_ID, 0]);
});

test('PATCH rejects a stale If-Match without issuing an UPDATE', async () => {
  let updateAttempted = false;
  const database: BookDatabase = {
    query: (statement) => {
      if (statement.startsWith('UPDATE')) {
        updateAttempted = true;
      }
      return Promise.resolve({ rows: [sampleBook] });
    },
  };
  const api = createApp(database);
  const response = await api.request('/api/buecher/1000', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': '"stale"' },
    body: JSON.stringify({ rating: 5 }),
  });

  assert.equal(response.status, 412);
  assert.equal(updateAttempted, false);
});
