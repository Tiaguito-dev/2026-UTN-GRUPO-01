CREATE TABLE "PasswordResetCredential" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "invalidatedAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    CONSTRAINT "PasswordResetCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetCredential_tokenHash_key" ON "PasswordResetCredential"("tokenHash");
CREATE INDEX "PasswordResetCredential_userId_idx" ON "PasswordResetCredential"("userId");
ALTER TABLE "PasswordResetCredential" ADD CONSTRAINT "PasswordResetCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
