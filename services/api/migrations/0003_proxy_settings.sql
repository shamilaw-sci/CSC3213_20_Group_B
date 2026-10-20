create table "proxySettings" (
  "email" text not null primary key,
  "username" text not null,
  "active" integer not null default 0 check ("active" in (0, 1)),
  "url" text not null default '',
  "availableAttempts" integer not null default 5 check ("availableAttempts" between 0 and 5),
  "attemptWindowStartedAt" integer,
  "updatedAt" integer,
  "updatedBy" text,
  "revision" integer not null default 1
);

create index "proxySettings_updatedAt_idx"
  on "proxySettings" ("updatedAt");
