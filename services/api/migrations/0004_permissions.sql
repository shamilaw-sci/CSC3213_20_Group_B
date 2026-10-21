create table "permission" (
  "email" text not null primary key collate nocase,
  "permissionJson" text not null check (json_valid("permissionJson")),
  "role" text not null check (
    "role" in (
      'USER',
      'OTHER',
      'STUDENT',
      'ACADEMIC',
      'NON_ACADEMIC',
      'ACADEMIC_SUPPORT'
    )
  ),
  "accessLevel" text not null default 'NONE' check (
    "accessLevel" in ('NONE', 'ADMIN', 'SUPER_ADMIN')
  ),
  "name" text not null default '',
  "picture" text not null default '',
  "blacklisted" integer not null default 0 check ("blacklisted" in (0, 1)),
  "createdAt" integer
);

create index "permission_accessLevel_idx"
  on "permission" ("accessLevel");
