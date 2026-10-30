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
export interface RegisterInput extends LoginInput { displayName: string }
export interface ResetPasswordInput { token: string; newPassword: string }
export interface ChangePasswordInput { currentPassword: string; newPassword: string }
