import type { PublicUser, User, UserRole } from "./user.js";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserRepository {
  findById(id: string): Promise<PublicUser | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}
