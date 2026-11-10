-- Match the additional identity constraints in D1 migration 0002.
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" ("providerId", "accountId");
CREATE UNIQUE INDEX "passkey_credentialID_unique" ON "passkey" ("credentialID");
