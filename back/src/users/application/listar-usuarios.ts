import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import type { PublicUser } from "../domain/user.js";
import type { UserRepository } from "../domain/user.repository.js";

export class ListarUsuarios {
  constructor(private readonly users: UserRepository) {}

  async execute(paginationInput: unknown): Promise<PaginatedResult<PublicUser>> {
    const pagination = validatePagination(paginationInput);
    return this.users.findAll(pagination);
  }
}
