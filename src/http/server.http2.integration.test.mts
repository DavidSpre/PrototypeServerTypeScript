import { type ClientHttp2Session, connect } from 'node:http2';
import { Hono } from 'hono';
import { TLSSocket } from 'node:tls';
import assert from 'node:assert/strict';
import { createHttp2Server } from './server.mts';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

const startTestServer = async () => {
  const certificate = await readFile(
    new URL('../../extras/compose/keycloak/tls/certificate.crt', import.meta.url),
  );
  const app = new Hono();
  app.get('/', (c) => c.text('http2-ready'));

  const server = await createHttp2Server(app.fetch, 0);
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new TypeError('Expected the HTTP/2 test server to have a TCP address');
  }
  return { server, port: address.port, certificate };
};

const requestRoot = async (client: ClientHttp2Session) => {
  const stream = client.request({ ':path': '/' });
  stream.end();
  const [headers] = await once(stream, 'response');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return { status: headers[':status'], body: Buffer.concat(chunks).toString() };
};

test('Hono server negotiates HTTP/2 over TLS', async () => {
  const { server, port, certificate } = await startTestServer();
  const client = connect(`https://127.0.0.1:${port}`, {
    ca: certificate,
    servername: 'localhost',
  });
  const closeServer = promisify(server.close.bind(server));
  try {
    await once(client, 'connect');
    const { socket } = client;
    if (!(socket instanceof TLSSocket)) {
      throw new TypeError('Expected an encrypted HTTP/2 socket');
    }
    assert.equal(socket.alpnProtocol, 'h2');
    const response = await requestRoot(client);
    assert.equal(response.status, 200);
    assert.equal(response.body, 'http2-ready');
  } finally {
    client.close();
    await closeServer();
  }
});
