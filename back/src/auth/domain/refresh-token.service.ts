export const REFRESH_TOKEN_SERVICE = Symbol("REFRESH_TOKEN_SERVICE");
export interface RefreshTokenService {
  generate(): { value: string; hash: string };
  hash(value: string): string | null;
}
