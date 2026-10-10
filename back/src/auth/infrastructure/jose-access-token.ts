import { SignJWT, jwtVerify } from "jose";
import type { AuthConfig } from "../auth.config.js";
import type { AccessTokenClaims, AccessTokenService } from "../domain/access-token.js";
import { InvalidAccessTokenError } from "../domain/auth-errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIMS = ["sub", "sessionId", "iat", "exp", "iss", "aud"];

export class JoseAccessTokenService implements AccessTokenService {
  constructor(private readonly config: AuthConfig, private readonly now: () => Date = () => new Date()) {}

  async issue(claims: AccessTokenClaims): Promise<string> {
    this.validateClaims(claims);
    return new SignJWT({ sessionId: claims.sessionId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(claims.userId).setIssuedAt(claims.issuedAt).setExpirationTime(claims.expiresAt)
      .setIssuer(this.config.issuer).setAudience(this.config.audience).sign(this.config.jwtSecret);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      if (typeof token !== "string" || token.length > 4096 || token.split(".").length !== 3) throw new InvalidAccessTokenError();
      const { payload, protectedHeader } = await jwtVerify(token, this.config.jwtSecret, {
        algorithms: ["HS256"], issuer: this.config.issuer, audience: this.config.audience,
        typ: "JWT", currentDate: this.now(), requiredClaims: CLAIMS,
      });
      if (protectedHeader.typ !== "JWT" || Object.keys(protectedHeader).some((key) => !["alg", "typ"].includes(key)) ||
        Object.keys(payload).some((key) => !CLAIMS.includes(key)) || payload.iss !== this.config.issuer || payload.aud !== this.config.audience) throw new InvalidAccessTokenError();
      const claims = { userId: payload.sub, sessionId: payload.sessionId, issuedAt: payload.iat, expiresAt: payload.exp };
      this.validateClaims(claims);
      if (claims.issuedAt > Math.floor(this.now().getTime() / 1000)) throw new InvalidAccessTokenError();
      return claims;
    } catch { throw new InvalidAccessTokenError(); }
  }

  private validateClaims(claims: { userId: unknown; sessionId: unknown; issuedAt: unknown; expiresAt: unknown }): asserts claims is AccessTokenClaims {
    if (typeof claims.userId !== "string" || !UUID.test(claims.userId) || typeof claims.sessionId !== "string" || !UUID.test(claims.sessionId) ||
      typeof claims.issuedAt !== "number" || !Number.isSafeInteger(claims.issuedAt) || claims.issuedAt < 0 ||
      typeof claims.expiresAt !== "number" || !Number.isSafeInteger(claims.expiresAt) ||
      claims.expiresAt <= claims.issuedAt || claims.expiresAt - claims.issuedAt > this.config.accessTtlSeconds) throw new InvalidAccessTokenError();
  }
}
