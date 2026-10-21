import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { AuthenticationUser, PublicUser, User, UserRole } from "./user.js";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserRepository {
  findAll(pagination: Pagination): Promise<PaginatedResult<PublicUser>>;
  findById(id: string): Promise<AuthenticationUser | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}
