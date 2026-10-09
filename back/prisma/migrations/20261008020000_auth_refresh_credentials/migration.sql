-- Additive migration: existing sessions keep their original expiration/revocation.
CREATE TABLE "RefreshCredential" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "invalidatedAt" TIMESTAMPTZ(3),
    CONSTRAINT "RefreshCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshCredential_tokenHash_key" ON "RefreshCredential"("tokenHash");
CREATE INDEX "RefreshCredential_sessionId_idx" ON "RefreshCredential"("sessionId");
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
