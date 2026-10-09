import { createHash, randomBytes } from "node:crypto";
import type { RefreshTokenService } from "../domain/refresh-token.service.js";

export class CryptoRefreshTokenService implements RefreshTokenService {
  generate(): { value: string; hash: string } {
    const value = randomBytes(32).toString("base64url");
    return { value, hash: createHash("sha256").update(value).digest("hex") };
  }
  hash(value: string): string | null {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length !== 32 || bytes.toString("base64url") !== value) return null;
    return createHash("sha256").update(value).digest("hex");
  }
}
