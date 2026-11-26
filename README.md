# PrototypeServerTypeScript
Repository for the prototype-server using TypeScript, Hono, and Drizzle. Part of the elective subject "AI-powered server development" by Prof. Dr. Jürgen Zimmermann at HKA

## Running the Hono server

Install dependencies and start the development server:

```sh
pnpm install
pnpm dev
```

The server listens on <http://localhost:3000/>. Run it without file watching
with `pnpm start`.

## Book REST API

The API uses the PostgreSQL `buch.buch` table and requires `DATABASE_URL` in
`.env`, plus the schema from the repository's Drizzle migrations.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/buecher` | List books; supports `isbn`, `rating`, `art`, `lieferbar`, `limit`, and `offset` query parameters. |
| `GET` | `/api/buecher/:id` | Fetch one book by its path ID. |
| `POST` | `/api/buecher` | Create a Zod-validated book; responds `201` with `Location` and `ETag` headers. |
| `PUT` | `/api/buecher/:id` | Replace a book; requires a complete representation and the current `If-Match` ETag. |
| `PATCH` | `/api/buecher/:id` | Update supplied fields; requires the current `If-Match` ETag. |

POST requires `isbn`, `rating`, `preis`, and `rabatt`. PUT requires every
mutable book field; PATCH accepts any non-empty subset.

GET responses include an `ETag`; send it as `If-None-Match` to receive
`304 Not Modified` when the representation has not changed. Updates atomically
check the row version, increment it, and return `412 Precondition Failed` for a
stale ETag or `428 Precondition Required` when `If-Match` is missing. Errors
use `application/problem+json` (RFC 9457).

## Keycloak authorization

`POST /api/buecher` requires a Keycloak bearer access token with the client role
`user` for client `javascript-client`. The other book methods remain public.
Tokens are signature-checked against the realm's JWKS, and their issuer and
authorized client (`azp`) are validated. Missing or invalid tokens receive
`401`; tokens without the required client role receive `403`.

The defaults match the realm and client described in
[`extras/compose/keycloak/ReadMe.md`](./extras/compose/keycloak/ReadMe.md):

- `KEYCLOAK_ISSUER`: `https://localhost:8843/realms/javascript`
- `KEYCLOAK_CLIENT_ID`: `javascript-client`

For the self-signed local Keycloak certificate, set Node's additional CA
certificate **before** starting the server (PowerShell):

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\extras\compose\keycloak\tls\certificate.crt"
$env:KEYCLOAK_ISSUER = "https://localhost:8843/realms/javascript"
$env:KEYCLOAK_CLIENT_ID = "javascript-client"
pnpm dev
```

The Keycloak setup in the linked guide assigns the `user` client role to the
`user` account. Obtain an access token from Keycloak and send it as
`Authorization: Bearer <access-token>` when calling `POST /api/buecher`.
`CLIENT_SECRET` is needed by the client when requesting a token, not by this
API for validating one; keep it out of source control. The password grant
described in the guide is suitable only for this local prototype.

## Tests

Tests run with Vitest:

```sh
pnpm test
pnpm test:unit
pnpm test:integration
```

Unit tests cover isolated ETag parsing. Integration tests exercise the Hono API
with a test database and the Keycloak authorization flow against a local test
JWKS server; they do not require a running PostgreSQL or Keycloak instance.
