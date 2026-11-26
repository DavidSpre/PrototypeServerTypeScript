import { type Book, type BookRow } from './types.mts';
import { createEntityTag, matchesIfNoneMatch, parseEntityTags } from '../http/entity-tag.mts';
import { type Context } from 'hono';
import { bookIdSchema } from './validation.mts';
import { problemResponse } from '../api/problem.mts';

const BAD_REQUEST = 400;

export const columns =
  '"id", "version", "isbn", "rating", "art", "preis", "rabatt", "lieferbar", "datum", "homepage", "schlagwoerter", "erzeugt", "aktualisiert"';

export const toBook = (row: BookRow): Book => {
  return {
    ...row,
    preis: Number(row.preis),
    rabatt: Number(row.rabatt),
    erzeugt: row.erzeugt.toISOString(),
    aktualisiert: row.aktualisiert.toISOString(),
  };
};

export const validationProblem = (
  c: Context,
  issues: Array<{ path: PropertyKey[]; message: string }>,
  status = 422,
): Response =>
  problemResponse({
    status,
    title: status === BAD_REQUEST ? 'Bad Request' : 'Unprocessable Content',
    detail: 'One or more request fields are invalid.',
    instance: c.req.path,
    errors: issues.map((issue) => {
      return {
        path: issue.path.map(String).join('.'),
        message: issue.message,
      };
    }),
  });

export const requireJson = (c: Context): Response | null => {
  const contentType = c.req.header('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType === 'application/json') {
    return null;
  }
  return problemResponse({
    status: 415,
    title: 'Unsupported Media Type',
    detail: 'Send the request body as application/json.',
    instance: c.req.path,
  });
};

export const invalidJsonProblem = (c: Context): Response =>
  problemResponse({
    status: BAD_REQUEST,
    title: 'Bad Request',
    detail: 'The request body must contain valid JSON.',
    instance: c.req.path,
  });

export const parseId = (c: Context): number | Response => {
  const result = bookIdSchema.safeParse(c.req.param('id'));
  return result.success ? result.data : validationProblem(c, result.error.issues, BAD_REQUEST);
};

export const parseIfMatch = (c: Context): string[] | Response => {
  const header = c.req.header('If-Match');
  if (header === undefined) {
    return problemResponse({
      status: 428,
      title: 'Precondition Required',
      detail: 'Include the strong ETag from a previous GET request in If-Match.',
      instance: c.req.path,
    });
  }

  const tags = parseEntityTags(header);
  if (tags === null || tags === '*') {
    return problemResponse({
      status: BAD_REQUEST,
      title: 'Bad Request',
      detail:
        'If-Match must contain one or more strong ETags; a wildcard does not prevent lost updates.',
      instance: c.req.path,
    });
  }
  return tags;
};

export const matchIfNoneMatch = (c: Context, etag: string): boolean | Response => {
  const header = c.req.header('If-None-Match');
  if (header === undefined) {
    return false;
  }

  const tags = parseEntityTags(header);
  if (tags === null) {
    return problemResponse({
      status: BAD_REQUEST,
      title: 'Bad Request',
      detail: 'If-None-Match must contain valid entity tags.',
      instance: c.req.path,
    });
  }
  return matchesIfNoneMatch(tags, etag);
};

export const sendJsonWithEtag = (c: Context, body: Book): Response => {
  c.header('ETag', createEntityTag(body));
  return c.json(body);
};

export const sendConditionalJson = (c: Context, body: Book | Book[]): Response => {
  const etag = createEntityTag(body);
  const matches = matchIfNoneMatch(c, etag);
  if (matches instanceof Response) {
    return matches;
  }
  if (matches) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  if (Array.isArray(body)) {
    c.header('ETag', etag);
    return c.json(body);
  }
  return sendJsonWithEtag(c, body);
};

export const notFound = (c: Context): Response =>
  problemResponse({
    status: 404,
    title: 'Not Found',
    detail: 'The requested book does not exist.',
    instance: c.req.path,
  });

export const preconditionFailed = (c: Context): Response =>
  problemResponse({
    status: 412,
    title: 'Precondition Failed',
    detail:
      'The book has changed since the supplied ETag was issued. Fetch it again before updating.',
    instance: c.req.path,
  });

export const strongTagMatches = (tags: string[], current: string): boolean =>
  tags.includes(current);
