CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" ("providerId", "accountId");

DROP INDEX "passkey_credentialID_idx";

CREATE UNIQUE INDEX "passkey_credentialID_unique" ON "passkey" ("credentialID");
