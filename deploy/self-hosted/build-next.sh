#!/bin/sh
set -eu

: "${APP:?Set APP to portal, people, projects, web, or docs}"
: "${SITE_DOMAIN:?Set SITE_DOMAIN}"

export NEXT_PUBLIC_BASE_API_URL="https://api.${SITE_DOMAIN}"
export NEXT_PUBLIC_API_BASE_URL="https://api.${SITE_DOMAIN}"
export NEXT_PUBLIC_PEOPLE_DATA_BASE_URL="https://data.${SITE_DOMAIN}/people/v2"
export NEXT_PUBLIC_PROJECTS_DATA_BASE_URL="https://data.${SITE_DOMAIN}/projects/v2"
export NEXT_PUBLIC_PEOPLE_SITE_URL="https://people.${SITE_DOMAIN}"
export NEXT_PUBLIC_PROJECTS_SITE_URL="https://projects.${SITE_DOMAIN}"
export NEXT_PUBLIC_DEPARTMENT_SITE_URL="https://${SITE_DOMAIN}"
export NEXT_PUBLIC_DOCS_SITE_URL="https://docs.${SITE_DOMAIN}"
export NEXT_PUBLIC_MOODLE_URL="$MOODLE_URL"
export NEXT_PUBLIC_API_CLIENT_ID=portal
export NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH=6

case "$APP" in
  portal|people|projects|docs) export NEXT_PUBLIC_SITE_URL="https://${APP}.${SITE_DOMAIN}" ;;
  web) export NEXT_PUBLIC_SITE_URL="https://${SITE_DOMAIN}" ;;
  *) echo "Unknown Next application: $APP" >&2; exit 1 ;;
esac

bun --filter "@scs/${APP}" build
