import { z } from "zod";
import { InvalidPaginationError } from "../../shared/domain/errors.js";
import type { UserAdministrationRepository } from "../domain/user-administration.repository.js";
import { validateUserId } from "./user-administration-input.js";

export class ListarHistorialUsuario {
  constructor(private readonly users: UserAdministrationRepository) {}
  execute(id: unknown, input: unknown) {
    const userId = validateUserId(id);
    const result = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(3).default(3) }).safeParse(input ?? {});
    if (!result.success) throw new InvalidPaginationError();
    return this.users.findHistorial(userId, result.data);
  }
}
