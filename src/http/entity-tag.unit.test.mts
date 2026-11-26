import { matchesIfNoneMatch, parseEntityTags } from './entity-tag.mts';
import assert from 'node:assert/strict';
import { test } from 'vitest';

test('ETag parsing preserves quoted commas and accepts weak validators', () => {
  const tags = parseEntityTags('"opaque,tag", W/"current"');

  assert.deepEqual(tags, ['"opaque,tag"', 'W/"current"']);
  assert.equal(matchesIfNoneMatch(tags ?? [], '"current"'), true);
});

test('ETag parsing recognizes wildcards and rejects malformed tags', () => {
  assert.equal(parseEntityTags('*'), '*');
  assert.equal(parseEntityTags('not-an-etag'), null);
});
