create unique index "account_provider_account_unique" on "account" ("providerId", "accountId");

drop index "passkey_credentialID_idx";

create unique index "passkey_credentialID_unique" on "passkey" ("credentialID");
