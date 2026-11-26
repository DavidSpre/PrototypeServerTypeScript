import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.mts';

export const relations = defineRelations(schema, (r) => ({
  abbildungInBuch: {
    buchInBuch: r.one.buchInBuchTable({
      from: r.abbildungInBuchTable.buchId,
      to: r.buchInBuchTable.id,
    }),
  },
  buchInBuch: {
    abbildungInBuches: r.many.abbildungInBuchTable(),
    buchFileInBuches: r.one.buchFileInBuchTable(),
    titelInBuches: r.one.titelInBuchTable(),
  },
  buchFileInBuch: {
    buchInBuch: r.one.buchInBuchTable({
      from: r.buchFileInBuchTable.buchId,
      to: r.buchInBuchTable.id,
    }),
  },
  titelInBuch: {
    buchInBuch: r.one.buchInBuchTable({
      from: r.titelInBuchTable.buchId,
      to: r.buchInBuchTable.id,
    }),
  },
}));
