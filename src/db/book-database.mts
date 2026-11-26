import { type BookDatabase, type BookFilters, type BookRow } from '../buch/types.mts';
import { type CreateBook, type PatchBook } from '../buch/validation.mts';
import { type InferSelectModel, type SQL, and, eq, inArray, sql } from 'drizzle-orm';
import {
  abbildungInBuchTable,
  buchFileInBuchTable,
  buchInBuchTable,
  titelInBuchTable,
} from './schema.mts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getPool } from './pool.mts';

const PRICE_DECIMAL_PLACES = 2;
const DISCOUNT_DECIMAL_PLACES = 3;

const createDatabase = () =>
  drizzle({
    client: getPool(),
  });

let database: ReturnType<typeof createDatabase> | undefined;

const getDatabase = () => {
  database ??= createDatabase();
  return database;
};

type BookBase = InferSelectModel<typeof buchInBuchTable>;

const getTitlesByBookId = async (ids: number[]) => {
  const titles = await getDatabase()
    .select({
      buchId: titelInBuchTable.buchId,
      id: titelInBuchTable.id,
      titel: titelInBuchTable.titel,
      untertitel: titelInBuchTable.untertitel,
    })
    .from(titelInBuchTable)
    .where(inArray(titelInBuchTable.buchId, ids));
  const titleByBookId = new Map<number, BookRow['titel']>();
  for (const title of titles) {
    titleByBookId.set(title.buchId, {
      id: title.id,
      titel: title.titel,
      untertitel: title.untertitel,
    });
  }
  return titleByBookId;
};

const getFilesByBookId = async (ids: number[]) => {
  const files = await getDatabase()
    .select({
      buchId: buchFileInBuchTable.buchId,
      id: buchFileInBuchTable.id,
      filename: buchFileInBuchTable.filename,
      mimetype: buchFileInBuchTable.mimetype,
    })
    .from(buchFileInBuchTable)
    .where(inArray(buchFileInBuchTable.buchId, ids));
  const fileByBookId = new Map<number, BookRow['datei']>();
  for (const file of files) {
    fileByBookId.set(file.buchId, {
      id: file.id,
      filename: file.filename,
      mimetype: file.mimetype,
    });
  }
  return fileByBookId;
};

const getImagesByBookId = async (ids: number[]) => {
  const images = await getDatabase()
    .select({
      buchId: abbildungInBuchTable.buchId,
      id: abbildungInBuchTable.id,
      beschriftung: abbildungInBuchTable.beschriftung,
      contentType: abbildungInBuchTable.contentType,
    })
    .from(abbildungInBuchTable)
    .where(inArray(abbildungInBuchTable.buchId, ids));
  const imagesByBookId = new Map<number, BookRow['abbildungen']>();
  for (const image of images) {
    const bookImages = imagesByBookId.get(image.buchId) ?? [];
    bookImages.push({
      id: image.id,
      beschriftung: image.beschriftung,
      contentType: image.contentType,
    });
    imagesByBookId.set(image.buchId, bookImages);
  }
  return imagesByBookId;
};

const loadBookRows = async (books: BookBase[]): Promise<BookRow[]> => {
  if (books.length === 0) {
    return [];
  }

  const ids = books.map((book) => book.id);
  const [titleByBookId, fileByBookId, imagesByBookId] = await Promise.all([
    getTitlesByBookId(ids),
    getFilesByBookId(ids),
    getImagesByBookId(ids),
  ]);
  return books.map((book) => {
    return {
      ...book,
      titel: titleByBookId.get(book.id) ?? null,
      datei: fileByBookId.get(book.id) ?? null,
      abbildungen: imagesByBookId.get(book.id) ?? [],
    };
  });
};

const findBookById = async (id: number): Promise<BookRow | undefined> => {
  const [book] = await getDatabase()
    .select()
    .from(buchInBuchTable)
    .where(eq(buchInBuchTable.id, id))
    .limit(1);

  if (book === undefined) {
    return undefined;
  }

  const [bookWithRelations] = await loadBookRows([book]);
  return bookWithRelations;
};

export const bookDatabase: BookDatabase = {
  listBooks: async (filters: BookFilters) => {
    const conditions: SQL[] = [];
    if (filters.isbn !== undefined) {
      conditions.push(eq(buchInBuchTable.isbn, filters.isbn));
    }
    if (filters.rating !== undefined) {
      conditions.push(eq(buchInBuchTable.rating, filters.rating));
    }
    if (filters.art !== undefined) {
      conditions.push(eq(buchInBuchTable.art, filters.art));
    }
    if (filters.lieferbar !== undefined) {
      conditions.push(eq(buchInBuchTable.lieferbar, filters.lieferbar));
    }

    const books = await getDatabase()
      .select()
      .from(buchInBuchTable)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(buchInBuchTable.id)
      .limit(filters.limit)
      .offset(filters.offset);

    return loadBookRows(books);
  },

  findBookById,

  createBook: async (book: CreateBook) => {
    const [created] = await getDatabase()
      .insert(buchInBuchTable)
      .values({
        isbn: book.isbn,
        rating: book.rating,
        art: book.art ?? null,
        preis: book.preis.toFixed(PRICE_DECIMAL_PLACES),
        rabatt: book.rabatt.toFixed(DISCOUNT_DECIMAL_PLACES),
        lieferbar: book.lieferbar ?? false,
        datum: book.datum ?? null,
        homepage: book.homepage ?? null,
        schlagwoerter: book.schlagwoerter ?? null,
      })
      .returning();

    if (created === undefined) {
      return undefined;
    }

    const [createdWithRelations] = await loadBookRows([created]);
    return createdWithRelations;
  },

  updateBookIfVersionMatches: async (id: number, version: number, fields: PatchBook) => {
    const { preis, rabatt, ...bookFields } = fields;
    const [updated] = await getDatabase()
      .update(buchInBuchTable)
      .set({
        ...bookFields,
        ...(preis === undefined ? {} : { preis: preis.toFixed(PRICE_DECIMAL_PLACES) }),
        ...(rabatt === undefined ? {} : { rabatt: rabatt.toFixed(DISCOUNT_DECIMAL_PLACES) }),
        version: sql`${buchInBuchTable.version} + 1`,
        aktualisiert: new Date(),
      })
      .where(and(eq(buchInBuchTable.id, id), eq(buchInBuchTable.version, version)))
      .returning();

    if (updated === undefined) {
      return undefined;
    }

    const [updatedWithRelations] = await loadBookRows([updated]);
    return updatedWithRelations;
  },
};
