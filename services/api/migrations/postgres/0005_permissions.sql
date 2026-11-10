-- Mirrors D1 migration 0004. Lowercase uniqueness preserves D1 NOCASE identity.
CREATE TABLE permission (
  email TEXT PRIMARY KEY,
  "permissionJson" JSONB NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('USER', 'OTHER', 'STUDENT', 'ACADEMIC', 'NON_ACADEMIC', 'ACADEMIC_SUPPORT')),
  "accessLevel" TEXT NOT NULL DEFAULT 'NONE' CHECK ("accessLevel" IN ('NONE', 'ADMIN', 'SUPER_ADMIN')),
  name TEXT NOT NULL DEFAULT '',
  picture TEXT NOT NULL DEFAULT '',
  blacklisted INTEGER NOT NULL DEFAULT 0 CHECK (blacklisted IN (0, 1)),
  "createdAt" BIGINT
);

CREATE UNIQUE INDEX permission_email_lower_idx ON permission (lower(email));
CREATE INDEX "permission_accessLevel_idx" ON permission ("accessLevel");
