export const PASSWORD_RESET_EMAIL = Symbol("PASSWORD_RESET_EMAIL");

export interface PasswordResetEmail {
  send(message: { email: string; token: string; expiresAt: Date }): Promise<void>;
}
