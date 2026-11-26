import { createHash } from 'node:crypto';

export const createEntityTag = (value: unknown): string => {
  const representation = JSON.stringify(value) ?? '';
  const digest = createHash('sha256').update(representation).digest('hex');
  return `"${digest}"`;
};

export const parseEntityTags = (header: string): string[] | '*' | null => {
  const value = header.trim();
  if (value === '*') {
    return '*';
  }

  const tags: string[] = [];
  let tokenStart = 0;
  let inQuotes = false;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) {
      tags.push(value.slice(tokenStart, index).trim());
      tokenStart = index + 1;
    }
  }
  tags.push(value.slice(tokenStart).trim());

  const valid = tags.every((tag) => /^(?:W\/)?"[\x21\x23-\x7E\x80-\xFF]*"$/u.test(tag));
  return inQuotes || !valid ? null : tags;
};

export const matchesIfNoneMatch = (tags: string[] | '*', current: string): boolean =>
  tags === '*' || tags.some((tag) => tag.replace(/^W\//u, '') === current);
