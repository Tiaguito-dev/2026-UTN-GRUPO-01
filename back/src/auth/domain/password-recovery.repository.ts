export const PASSWORD_RECOVERY_REPOSITORY = Symbol("PASSWORD_RECOVERY_REPOSITORY");

export interface PasswordResetCredential {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
  deliveredAt: Date | null;
}

export interface PasswordRecoveryRepository {
  issue(credential: PasswordResetCredential): Promise<void>;
  invalidate(credentialId: string, now: Date): Promise<void>;
  markDelivered(credentialId: string, now: Date): Promise<void>;
  findByHash(hash: string): Promise<PasswordResetCredential | null>;
  reset(hash: string, newPasswordHash: string, now: Date): Promise<boolean>;
  findPasswordByUserId(userId: string): Promise<{ id: string; passwordHash: string } | null>;
  change(userId: string, expectedPasswordHash: string, newPasswordHash: string, now: Date): Promise<boolean>;
}
