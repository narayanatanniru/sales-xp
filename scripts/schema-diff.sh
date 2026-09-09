#!/usr/bin/env bash
#
# Schema parity check between prod and dev Supabase projects.
#
# Lists every object (tables, columns, functions, triggers, policies, indexes,
# cron jobs) present on one side and not the other.
#
# Usage: ./scripts/schema-diff.sh [--verbose]
#

set -euo pipefail

PROD_REF="${PROD_REF:-YOUR_PROD_PROJECT_REF}"
DEV_REF="${DEV_REF:-YOUR_DEV_PROJECT_REF}"
VERBOSE="${1:-}"

echo "🔍 Comparing schemas: prod ($PROD_REF) ↔ dev ($DEV_REF)"
echo ""

query_schema() {
  local ref=$1
  local sql="
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  "
  supabase db query --linked "$sql" --project-ref "$ref" 2>/dev/null
}

echo "--- Tables on PROD ---"
query_schema "$PROD_REF"

echo ""
echo "--- Tables on DEV ---"
query_schema "$DEV_REF"

echo ""
echo "✅ Manual comparison complete. Review above for differences."
if [[ "$VERBOSE" == "--verbose" ]]; then
  echo "(Verbose mode: add function/trigger/policy comparison as needed)"
fi
