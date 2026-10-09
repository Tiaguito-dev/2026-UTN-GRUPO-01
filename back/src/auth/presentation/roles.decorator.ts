import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "../../users/domain/user.js";

export const ALLOWED_ROLES = Symbol("ALLOWED_ROLES");
export const Roles = (...roles: UserRole[]) => SetMetadata(ALLOWED_ROLES, roles);
