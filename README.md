# PrototypeServerTypeScript
Repository for the prototype-server using TypeScript, Hono, and Drizzle. Part of the elective subject "AI-powered server development" by Prof. Dr. Jürgen Zimmermann at HKA

## Running the Hono server

Install dependencies and start the development server:

```sh
pnpm install
pnpm dev
```

The server listens on <https://localhost:3000/> and negotiates HTTP/2 over TLS,
with HTTP/1.1 fallback. It uses the local certificate in
`extras/compose/keycloak/tls/` by default; override it with
`TLS_CERTIFICATE_PATH` and `TLS_PRIVATE_KEY_PATH`. Run it without file watching
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

`POST /api/buecher` requires a Keycloak bearer access token for the `user`
account with the client role `user` for client `javascript-client`. The other
book methods remain public.
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

## Testing the API with Bruno

Before testing, set up PostgreSQL and create the `buch` database and schema as
described in [`extras/compose/postgres/ReadMe.md`](./extras/compose/postgres/ReadMe.md).
Set `DATABASE_URL` in the project-root `.env` file. Set up the Keycloak realm,
client, `user` account, and `user` client role as described in
[`extras/compose/keycloak/ReadMe.md`](./extras/compose/keycloak/ReadMe.md).

Start Keycloak and PostgreSQL, then start the API in PowerShell. Node must trust
the local self-signed Keycloak certificate so it can fetch Keycloak's signing
keys:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\extras\compose\keycloak\tls\certificate.crt"
$env:KEYCLOAK_ISSUER = "https://localhost:8843/realms/javascript"
$env:KEYCLOAK_CLIENT_ID = "javascript-client"
pnpm dev
```

In Bruno, allow the local self-signed certificate for `localhost` (or add it to
the trusted certificates) for both the API and Keycloak. Do not disable
certificate verification for production services. Create a Bruno environment
with these variables:

```text
baseUrl     https://localhost:3000
keycloakUrl https://localhost:8843
accessToken
```

### Get a Keycloak access token

Create a `POST` request to
`{{keycloakUrl}}/realms/javascript/protocol/openid-connect/token`. Under **Body**,
select **Form URL Encoded** and add:

| Key | Value |
| --- | --- |
| `grant_type` | `password` |
| `client_id` | `javascript-client` |
| `client_secret` | The secret from the `javascript-client` credentials in Keycloak |
| `username` | `user` |
| `password` | The password configured for that Keycloak user |

Send the request and copy `access_token` from the JSON response into the
environment's `accessToken` variable. Keep the client secret private; do not
commit it or share it in a Bruno collection.

### Send API requests

- **List books:** `GET {{baseUrl}}/api/buecher`. Optional query parameters
  include `isbn`, `rating`, `art`, `lieferbar`, `limit`, and `offset`.
- **Get one book:** `GET {{baseUrl}}/api/buecher/{id}`. Use an ID from the list
  response. Copy the response `ETag` header.
- **Test conditional GET:** repeat that GET with the header
  `If-None-Match: <copied ETag>`. The expected response is `304 Not Modified`.
- **Create a book:** `POST {{baseUrl}}/api/buecher` with headers
  `Authorization: Bearer {{accessToken}}` and `Content-Type: application/json`.
  Send a JSON body such as:

  ```json
  {
    "isbn": "978-3-16-148410-0",
    "rating": 4,
    "preis": 11.1,
    "rabatt": 0.011
  }
  ```

  Use an ISBN not already present in the database. A successful response is
  `201 Created` and includes `Location` and `ETag` headers. A duplicate ISBN
  returns `409 Conflict`.
- **Update a book:** send `PATCH {{baseUrl}}/api/buecher/{id}` with
  `Content-Type: application/json`, the current
  `If-Match: <copied ETag>` header, and a non-empty JSON object such as
  `{"rating": 5}`. A missing `If-Match` returns `428`; a stale ETag returns
  `412 Precondition Failed`.

Invalid input and other API errors are returned as
`application/problem+json` (RFC 9457). Only `POST /api/buecher` requires the
Keycloak token; the GET, PUT, and PATCH routes are public.

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
