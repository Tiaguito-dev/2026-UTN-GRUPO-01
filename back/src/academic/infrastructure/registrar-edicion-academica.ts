import type { Prisma } from "../../generated/prisma/client.js";
import type { AcademicEntity } from "../application/ports/academic-administration.repository.js";

/** Se ejecuta en la misma transacción y después del bloqueo de fila del recurso. */
export async function registrarEdicionAcademica<T extends object>(
  tx: Prisma.TransactionClient, entidad: AcademicEntity, entidadId: string, actorId: string,
  anterior: T, nuevo: T, campos: (keyof T & string)[],
): Promise<void> {
  const text = (value: unknown) => value === null || value === undefined ? null : String(value);
  const cambios = campos.filter((campo) => anterior[campo] !== nuevo[campo])
    .map((campo) => ({ campo, anterior: text(anterior[campo]), nuevo: text(nuevo[campo]) }));
  if (cambios.length) await tx.administracionHistorial.create({ data: { entidad, entidadId, actorId, accion: "EDICION", cambios } });
}
