import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { AuthenticationUser, User, UserRole } from "./user.js";
import type { UsuarioAdministrativo, UserFilters } from "./user-administration.repository.js";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  /** Solo el alta pública validada registra consentimiento; la provisión administrativa lo omite. */
  versionTerminos?: string;
}

export interface UserRepository {
  findAll(pagination: Pagination, filters?: UserFilters): Promise<PaginatedResult<UsuarioAdministrativo>>;
  findById(id: string): Promise<AuthenticationUser | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}
