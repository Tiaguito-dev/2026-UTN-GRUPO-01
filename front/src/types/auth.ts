export type Role = "ADMIN" | "USER";
export interface PublicAccount {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt?: string;
}
export type AuthStatus = "checking" | "authenticated" | "anonymous" | "temporary-error";
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { displayName: string; aceptaTerminos: boolean; versionTerminos: string }
export interface TerminosCondiciones { version: string; secciones: { titulo: string; parrafos: string[] }[] }
export interface ResetPasswordInput { token: string; newPassword: string }
export interface ChangePasswordInput { currentPassword: string; newPassword: string }
