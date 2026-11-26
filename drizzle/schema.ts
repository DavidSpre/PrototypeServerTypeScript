import {
  pgSchema,
  pgTable,
  integer,
  text,
  customType,
  pgEnum,
  numeric,
  boolean,
  date,
  jsonb,
  timestamp,
  index,
  foreignKey,
  primaryKey,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const buch = pgSchema('buch');
export const buchartInBuch = buch.enum('buchart', ['EPUB', 'HARDCOVER', 'PAPERBACK']);

export const abbildungInBuch = buch.table(
  'abbildung',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({ startWith: 1000 }),
    beschriftung: text().notNull(),
    contentType: text('content_type').notNull(),
    buchId: integer('buch_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.buchId],
      foreignColumns: [buchInBuch.id],
      name: 'abbildung_buch_id_fkey',
    }).onDelete('cascade'),
    index('abbildung_buch_id_idx').using('btree', table.buchId.asc().nullsLast()),
  ],
);

export const buchInBuch = buch.table(
  'buch',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({ startWith: 1000 }),
    version: integer().default(0).notNull(),
    isbn: text().notNull(),
    rating: integer().notNull(),
    art: buchartInBuch(),
    preis: numeric({ precision: 8, scale: 2 }).notNull(),
    rabatt: numeric({ precision: 4, scale: 3 }).notNull(),
    lieferbar: boolean().default(false).notNull(),
    datum: date(),
    homepage: text(),
    schlagwoerter: jsonb(),
    erzeugt: timestamp()
      .default(sql`now()`)
      .notNull(),
    aktualisiert: timestamp()
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    unique('buch_isbn_key').on(table.isbn),
    check('buch_rating_check', sql`((rating >= 0) AND (rating <= 5))`),
  ],
);

export const buchFileInBuch = buch.table(
  'buch_file',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({ startWith: 1000 }),
    data: customType({ dataType: () => 'bytea' })().notNull(),
    filename: text().notNull(),
    mimetype: text(),
    buchId: integer('buch_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.buchId],
      foreignColumns: [buchInBuch.id],
      name: 'buch_file_buch_id_fkey',
    }).onDelete('cascade'),
    index('buch_file_buch_id_idx').using('btree', table.buchId.asc().nullsLast()),
    unique('buch_file_buch_id_key').on(table.buchId),
  ],
);

export const titelInBuch = buch.table(
  'titel',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({ startWith: 1000 }),
    titel: text().notNull(),
    untertitel: text(),
    buchId: integer('buch_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.buchId],
      foreignColumns: [buchInBuch.id],
      name: 'titel_buch_id_fkey',
    }).onDelete('cascade'),
    unique('titel_buch_id_key').on(table.buchId),
  ],
);
