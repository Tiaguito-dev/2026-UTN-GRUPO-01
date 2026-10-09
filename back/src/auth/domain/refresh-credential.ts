export interface RefreshCredential {
  id: string;
  sessionId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
}
