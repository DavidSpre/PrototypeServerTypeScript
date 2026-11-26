import { type QueryResultRow } from 'pg';

export type BookRow = QueryResultRow & {
  id: number;
  version: number;
  isbn: string;
  rating: number;
  art: string | null;
  preis: string;
  rabatt: string;
  lieferbar: boolean;
  datum: string | null;
  homepage: string | null;
  schlagwoerter: unknown;
  erzeugt: Date;
  aktualisiert: Date;
};

export type Book = Omit<BookRow, 'preis' | 'rabatt' | 'erzeugt' | 'aktualisiert'> & {
  preis: number;
  rabatt: number;
  erzeugt: string;
  aktualisiert: string;
};

export type BookDatabase = {
  query: (statement: string, values?: unknown[]) => Promise<{ rows: BookRow[] }>;
};
