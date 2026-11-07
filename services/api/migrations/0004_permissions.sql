CREATE TABLE "permission" (
  "email" TEXT NOT NULL PRIMARY KEY COLLATE NOCASE,
  "permissionJson" TEXT NOT NULL CHECK (json_valid("permissionJson")),
  "role" TEXT NOT NULL CHECK (
    "role" IN (
      'USER',
      'OTHER',
      'STUDENT',
      'ACADEMIC',
      'NON_ACADEMIC',
      'ACADEMIC_SUPPORT'
    )
  ),
  "accessLevel" TEXT NOT NULL DEFAULT 'NONE' CHECK (
    "accessLevel" IN ('NONE', 'ADMIN', 'SUPER_ADMIN')
  ),
  "name" TEXT NOT NULL DEFAULT '',
  "picture" TEXT NOT NULL DEFAULT '',
  "blacklisted" INTEGER NOT NULL DEFAULT 0 CHECK ("blacklisted" IN (0, 1)),
  "createdAt" INTEGER
);

CREATE INDEX "permission_accessLevel_idx"
  ON "permission" ("accessLevel");
