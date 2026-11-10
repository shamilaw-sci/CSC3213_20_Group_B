-- Generated from the Better Auth 1.7.7 PostgreSQL migration plan and reviewed.
-- Apply with the intended schema in search_path before application startup.
CREATE TABLE "user" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "emailVerified" BOOLEAN NOT NULL, "image" TEXT, "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TABLE "session" ("id" TEXT NOT NULL PRIMARY KEY, "expiresAt" TIMESTAMPTZ NOT NULL, "token" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL, "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE);

CREATE TABLE "account" ("id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" TIMESTAMPTZ, "refreshTokenExpiresAt" TIMESTAMPTZ, "scope" TEXT, "password" TEXT, "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL);

CREATE TABLE "verification" ("id" TEXT NOT NULL PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TABLE "passkey" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT, "publicKey" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "credentialID" TEXT NOT NULL, "counter" INTEGER NOT NULL, "deviceType" TEXT NOT NULL, "backedUp" BOOLEAN NOT NULL, "transports" TEXT, "createdAt" TIMESTAMPTZ, "aaguid" TEXT);

CREATE TABLE "rateLimit" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "count" INTEGER NOT NULL, "lastRequest" BIGINT NOT NULL);

CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
CREATE INDEX "passkey_userId_idx" ON "passkey" ("userId");
CREATE INDEX "passkey_credentialID_idx" ON "passkey" ("credentialID");
