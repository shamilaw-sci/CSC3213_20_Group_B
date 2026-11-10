-- Mirrors D1 migrations 0003 and 0005. Epoch timestamps and revisions remain exact BIGINTs.
CREATE TABLE "proxySettings" (
  email TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  url TEXT NOT NULL DEFAULT '',
  "availableAttempts" INTEGER NOT NULL DEFAULT 5 CHECK ("availableAttempts" BETWEEN 0 AND 5),
  "attemptWindowStartedAt" BIGINT,
  "updatedAt" BIGINT,
  "updatedBy" TEXT,
  revision BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX "proxySettings_updatedAt_idx" ON "proxySettings" ("updatedAt");
CREATE INDEX "proxySettings_username_idx" ON "proxySettings" (username);
