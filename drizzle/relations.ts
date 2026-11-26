import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  abbildungInBuch: {
    buchInBuch: r.one.buchInBuch({
      from: r.abbildungInBuch.buchId,
      to: r.buchInBuch.id,
    }),
  },
  buchInBuch: {
    abbildungInBuches: r.many.abbildungInBuch(),
    buchFileInBuches: r.one.buchFileInBuch(),
    titelInBuches: r.one.titelInBuch(),
  },
  buchFileInBuch: {
    buchInBuch: r.one.buchInBuch({
      from: r.buchFileInBuch.buchId,
      to: r.buchInBuch.id,
    }),
  },
  titelInBuch: {
    buchInBuch: r.one.buchInBuch({
      from: r.titelInBuch.buchId,
      to: r.buchInBuch.id,
    }),
  },
}));
