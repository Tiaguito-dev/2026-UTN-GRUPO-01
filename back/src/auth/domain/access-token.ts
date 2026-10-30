export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

export const ACCESS_TOKEN_SERVICE = Symbol("ACCESS_TOKEN_SERVICE");

export interface AccessTokenService {
  issue(claims: AccessTokenClaims): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims>;
}
