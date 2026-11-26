import { type Hono } from 'hono';
import { createAdaptorServer } from '@hono/node-server';
import { createSecureServer } from 'node:http2';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const readTlsFile = (environmentVariable: string, defaultPath: URL): Promise<Buffer> => {
  const configuredPath = process.env[environmentVariable];
  return readFile(configuredPath === undefined ? defaultPath : resolve(configuredPath));
};

export const createHttp2Server = async (fetch: Hono['fetch'], port: number) => {
  const [certificate, privateKey] = await Promise.all([
    readTlsFile(
      'TLS_CERTIFICATE_PATH',
      new URL('../../extras/compose/keycloak/tls/certificate.crt', import.meta.url),
    ),
    readTlsFile(
      'TLS_PRIVATE_KEY_PATH',
      new URL('../../extras/compose/keycloak/tls/key.pem', import.meta.url),
    ),
  ]);
  return createAdaptorServer({
    fetch,
    port,
    createServer: createSecureServer,
    serverOptions: {
      allowHTTP1: true,
      cert: certificate,
      key: privateKey,
    },
  });
};
