export type UserRole = "ADMIN" | "USER";

export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  emailVerifiedAt?: Date | null;
  disabledAt?: Date | null;
}

export type PublicUser = Omit<User, "passwordHash" | "emailVerifiedAt" | "disabledAt">;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export type AuthenticationUser = PublicUser & Pick<User, "emailVerifiedAt" | "disabledAt">;

export function canAuthenticate(user: { role: UserRole; emailVerifiedAt?: Date | null; disabledAt?: Date | null }): boolean {
  return !user.disabledAt && (user.role === "ADMIN" || user.emailVerifiedAt instanceof Date);
}
