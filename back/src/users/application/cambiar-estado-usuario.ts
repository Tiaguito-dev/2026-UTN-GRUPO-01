import { z } from "zod";
import { InvalidUserAdministrationInputError, UserStateConflictError } from "../domain/errors.js";
import type { UserAdministrationRepository, UsuarioAdministrativo } from "../domain/user-administration.repository.js";
import { validateUserId } from "./user-administration-input.js";

export class CambiarEstadoUsuario {
  constructor(private readonly users: UserAdministrationRepository) {}

  async execute(id: unknown, input: unknown, actorId: unknown): Promise<UsuarioAdministrativo> {
    const target = validateUserId(id); const actor = validateUserId(actorId);
    const result = z.strictObject({ activo: z.boolean() }).safeParse(input);
    if (!result.success) throw new InvalidUserAdministrationInputError("Indique solamente si la cuenta debe estar activa e intente nuevamente.");
    if (!result.data.activo && target === actor) throw new UserStateConflictError("No puede desactivar su propia cuenta. Solicite la operación a otro administrador.");
    return this.users.setActive(target, result.data.activo, actor);
  }
}
