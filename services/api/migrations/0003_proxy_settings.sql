CREATE TABLE "proxySettings" (
  "email" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 0 CHECK ("active" IN (0, 1)),
  "url" TEXT NOT NULL DEFAULT '',
  "availableAttempts" INTEGER NOT NULL DEFAULT 5 CHECK ("availableAttempts" BETWEEN 0 AND 5),
  "attemptWindowStartedAt" INTEGER,
  "updatedAt" INTEGER,
  "updatedBy" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX "proxySettings_updatedAt_idx"
  ON "proxySettings" ("updatedAt");
