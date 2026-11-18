import { Prisma } from "../../generated/prisma/client.js";
import { PUBLIC_FEEDBACK_REQUIREMENTS } from "../domain/feedback-visibility.js";

export const publicFeedbackWhere = { ...PUBLIC_FEEDBACK_REQUIREMENTS } satisfies Prisma.FeedbackWhereInput;

/** Aliases and column names are internal identifiers, never external query input. */
export function publicFeedbackSql(alias: "f" | "feedback" = "f"): Prisma.Sql {
  const predicates = Object.entries(PUBLIC_FEEDBACK_REQUIREMENTS).map(([field, value]) => {
    const column = Prisma.raw(`"${alias}"."${field}"`);
    if (value === null) return Prisma.sql`${column} IS NULL`;
    if (typeof value === "string") return Prisma.sql`${column} = ${value}::"FeedbackEstadoModeracion"`;
    return Prisma.sql`${column} = ${value}`;
  });
  return Prisma.sql`(${Prisma.join(predicates, " AND ")})`;
}
