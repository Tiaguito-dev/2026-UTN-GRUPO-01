import { z } from "zod";
import { InvalidUserAdministrationInputError } from "../domain/errors.js";
import type { UserFilters } from "../domain/user-administration.repository.js";

export function validateUserId(value: unknown): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new InvalidUserAdministrationInputError("La cuenta seleccionada no es válida. Actualice el listado.");
  return result.data;
}

export function validateUserFilters(input: unknown): UserFilters {
  const result = z.object({
    // eslint-disable-next-line no-control-regex -- Rechaza caracteres de control del texto de búsqueda.
    q: z.string().refine((text) => !/[\u0000-\u001f\u007f-\u009f]/u.test(text)).transform((text) => text.trim()).refine((text) => Array.from(text).length <= 150).optional(),
    rol: z.enum(["ADMIN", "USER"]).optional(),
    estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
  }).safeParse(input ?? {});
  if (!result.success) throw new InvalidUserAdministrationInputError();
  return { ...result.data, q: result.data.q || undefined };
}
