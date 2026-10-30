import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import type { UsuarioAdministrativo } from "../domain/user-administration.repository.js";
import { validateUserFilters } from "./user-administration-input.js";
import type { UserRepository } from "../domain/user.repository.js";

export class ListarUsuarios {
  constructor(private readonly users: UserRepository) {}

  async execute(paginationInput: unknown): Promise<PaginatedResult<UsuarioAdministrativo>> {
    const pagination = validatePagination(paginationInput);
    return this.users.findAll(pagination, validateUserFilters(paginationInput));
  }
}
