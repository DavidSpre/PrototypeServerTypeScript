import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { after, test } from 'node:test';
import { emptyDatabase, sampleBook } from './api.test-support.mts';
import { type BookDatabase } from './buch/types.mts';
import assert from 'node:assert/strict';
import { createApp } from './app.mts';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { requireKeycloakRole } from './auth/keycloak.mts';

const CLIENT_ID = 'javascript-client';
const CLIENT_ROLE = 'user';
const JWKS_PATH = '/realms/javascript/protocol/openid-connect/certs';
const keyPair = await generateKeyPair('RS256', { modulusLength: 2048 });
const signingJwk = {
  ...(await exportJWK(keyPair.publicKey)),
  alg: 'RS256',
  kid: 'test-key',
  use: 'sig',
};
const jwksServer = createServer((request, response) => {
  if (request.url !== JWKS_PATH) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'Cache-Control': 'public, max-age=60',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify({ keys: [signingJwk] }));
});
const serverReady = once(jwksServer, 'listening');
jwksServer.listen(0, '127.0.0.1');
await serverReady;

const address = jwksServer.address();
if (address === null || typeof address === 'string') {
  throw new TypeError('Expected the JWKS test server to have a TCP address');
}
const issuer = `http://127.0.0.1:${address.port}/realms/javascript`;

const createToken = (roles: string[]) =>
  new SignJWT({
    azp: CLIENT_ID,
    resource_access: {
      [CLIENT_ID]: { roles },
    },
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })
    .setIssuer(issuer)
    .setSubject('user')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(keyPair.privateKey);

let createBookCalls = 0;
const database: BookDatabase = {
  ...emptyDatabase,
  createBook: () => {
    createBookCalls += 1;
    return Promise.resolve(sampleBook);
  },
};
const api = createApp(
  database,
  requireKeycloakRole({
    role: CLIENT_ROLE,
    issuer,
    clientId: CLIENT_ID,
  }),
);

const postBook = (token?: string) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return api.request('/api/buecher', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      isbn: sampleBook.isbn,
      rating: sampleBook.rating,
      preis: 11.1,
      rabatt: 0.011,
    }),
  });
};

const closeJwksServer = promisify(jwksServer.close.bind(jwksServer));

after(async () => {
  await closeJwksServer();
});

test('only POST /api/buecher requires the Keycloak user client role', async () => {
  const publicResponse = await api.request('/api/buecher');
  assert.equal(publicResponse.status, 200);

  const unauthenticatedResponse = await postBook();
  assert.equal(unauthenticatedResponse.status, 401);
  assert.equal(unauthenticatedResponse.headers.get('WWW-Authenticate'), 'Bearer');

  const wrongRoleResponse = await postBook(await createToken(['admin']));
  assert.equal(wrongRoleResponse.status, 403);

  const authorizedResponse = await postBook(await createToken([CLIENT_ROLE]));
  assert.equal(authorizedResponse.status, 201);
  assert.equal(createBookCalls, 1);
});
