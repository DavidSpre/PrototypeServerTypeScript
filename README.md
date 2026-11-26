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
