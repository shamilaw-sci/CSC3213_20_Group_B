#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v api_password="$API_DB_PASSWORD" \
  -v github_password="$GITHUB_DB_PASSWORD" \
  -v migration_password="$MIGRATION_DB_PASSWORD" <<'SQL'
CREATE ROLE scs_migrator LOGIN PASSWORD :'migration_password';
CREATE ROLE scs_api LOGIN PASSWORD :'api_password';
CREATE ROLE scs_worker LOGIN PASSWORD :'github_password';
GRANT CREATE ON DATABASE scs TO scs_migrator;

CREATE SCHEMA scs_api AUTHORIZATION scs_migrator;
CREATE SCHEMA scs_operations AUTHORIZATION scs_migrator;
CREATE SCHEMA scs_jobs AUTHORIZATION scs_migrator;

GRANT USAGE ON SCHEMA scs_api TO scs_api;
GRANT USAGE ON SCHEMA scs_operations, scs_jobs TO scs_worker;

ALTER DEFAULT PRIVILEGES FOR ROLE scs_migrator IN SCHEMA scs_api
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scs_api;
ALTER DEFAULT PRIVILEGES FOR ROLE scs_migrator IN SCHEMA scs_api
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO scs_api;
ALTER DEFAULT PRIVILEGES FOR ROLE scs_migrator IN SCHEMA scs_operations, scs_jobs
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scs_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE scs_migrator IN SCHEMA scs_operations, scs_jobs
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO scs_worker;
SQL
