CREATE TABLE "orcid_link_intent" (
  "userId" TEXT NOT NULL PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "stateHash" TEXT NOT NULL UNIQUE,
  "sessionId" TEXT NOT NULL,
  "portalOrigin" TEXT NOT NULL,
  "expiresAt" BIGINT NOT NULL
);

CREATE UNIQUE INDEX "account_one_orcid_per_user" ON "account"("userId", "providerId") WHERE "providerId" = 'orcid';
