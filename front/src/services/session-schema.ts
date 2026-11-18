import { z } from "zod";
import type { SessionStatus } from "@/types/session";

const timestamp = z.iso.datetime({ offset: true });
export const sessionStatusSchema: z.ZodType<SessionStatus> = z.object({
  serverNow: timestamp,
  warningAt: timestamp,
  idleExpiresAt: timestamp,
  absoluteExpiresAt: timestamp,
}).strict().refine((value) => Date.parse(value.warningAt) < Math.min(Date.parse(value.idleExpiresAt), Date.parse(value.absoluteExpiresAt)), {
  message: "Los plazos de la sesión no son válidos.",
});
