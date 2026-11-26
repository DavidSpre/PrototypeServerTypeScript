import { type CreateBook, type PatchBook } from './validation.mts';
import {
  abbildungInBuchTable,
  buchFileInBuchTable,
  buchInBuchTable,
  titelInBuchTable,
} from '../db/schema.mts';
import { type InferSelectModel } from 'drizzle-orm';

type BookBase = InferSelectModel<typeof buchInBuchTable>;
type TitleSummary = Pick<InferSelectModel<typeof titelInBuchTable>, 'id' | 'titel' | 'untertitel'>;
type ImageSummary = Pick<
  InferSelectModel<typeof abbildungInBuchTable>,
  'id' | 'beschriftung' | 'contentType'
>;
type FileSummary = Pick<
  InferSelectModel<typeof buchFileInBuchTable>,
  'id' | 'filename' | 'mimetype'
>;

export type BookRow = BookBase & {
  titel: TitleSummary | null;
  datei: FileSummary | null;
  abbildungen: ImageSummary[];
};

export type Book = Omit<BookRow, 'preis' | 'rabatt' | 'erzeugt' | 'aktualisiert'> & {
  preis: number;
  rabatt: number;
  erzeugt: string;
  aktualisiert: string;
};

export type BookFilters = {
  limit: number;
  offset: number;
  isbn?: string | undefined;
  rating?: number | undefined;
  art?: 'EPUB' | 'HARDCOVER' | 'PAPERBACK' | undefined;
  lieferbar?: boolean | undefined;
};

export type BookDatabase = {
  listBooks: (filters: BookFilters) => Promise<BookRow[]>;
  findBookById: (id: number) => Promise<BookRow | undefined>;
  createBook: (book: CreateBook) => Promise<BookRow | undefined>;
  updateBookIfVersionMatches: (
    id: number,
    version: number,
    fields: PatchBook,
  ) => Promise<BookRow | undefined>;
};
