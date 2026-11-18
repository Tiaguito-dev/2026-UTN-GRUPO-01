-- Existing sessions receive one idle window from deployment; absolute expiry is preserved.
ALTER TABLE "Session" ADD COLUMN "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
