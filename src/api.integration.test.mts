import { createTestApp, emptyDatabase, readJsonObject } from './api.test-support.mts';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const BAD_REQUEST = 400;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UNPROCESSABLE_CONTENT = 422;
const testApp = createTestApp(emptyDatabase);

test('book routes return Problem Details for invalid path parameters', async () => {
  const response = await testApp.request('/api/buecher/not-an-id');
  const body = await readJsonObject(response);

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
  const body = await readJsonObject(response);

  assert.equal(response.status, UNPROCESSABLE_CONTENT);
  assert.equal(body.status, UNPROCESSABLE_CONTENT);
  assert.ok(Array.isArray(body.errors));
});

test('book routes reject invalid query parameters before accessing the database', async () => {
  const response = await testApp.request('/api/buecher?rating=7');
  const body = await readJsonObject(response);

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
  const body = await readJsonObject(response);

  assert.equal(response.status, 428);
  assert.equal(body.type, 'about:blank');
});

test('PUT requires a complete Zod-validated book representation', async () => {
  const response = await testApp.request('/api/buecher/1000', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': '"current"' },
    body: JSON.stringify({ rating: 4 }),
  });
  const body = await readJsonObject(response);

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
