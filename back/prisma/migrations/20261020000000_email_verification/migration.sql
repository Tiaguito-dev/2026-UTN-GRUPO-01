ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3);
CREATE TABLE "EmailVerificationCredential" (
 "id" UUID NOT NULL, "userId" UUID NOT NULL, "tokenHash" CHAR(64) NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 "consumedAt" TIMESTAMPTZ(3), "invalidatedAt" TIMESTAMPTZ(3), "deliveredAt" TIMESTAMPTZ(3),
 CONSTRAINT "EmailVerificationCredential_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "EmailVerificationCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailVerificationCredential_tokenHash_key" ON "EmailVerificationCredential"("tokenHash");
CREATE INDEX "EmailVerificationCredential_userId_idx" ON "EmailVerificationCredential"("userId");
