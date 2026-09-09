#!/usr/bin/env bash
#
# Apply pending migrations to the linked Supabase project.
#
# Usage:
#   ./scripts/apply-pending-migrations.sh --dry-run   # wraps in transaction + rollback
#   ./scripts/apply-pending-migrations.sh --apply      # applies for real
#

set -euo pipefail

MIGRATION_DIR="src/supabase/migrations"
MODE="${1:---dry-run}"

if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "❌ Migration directory not found: $MIGRATION_DIR"
  exit 1
fi

FILES=$(find "$MIGRATION_DIR" -name '*.sql' | sort)
COUNT=$(echo "$FILES" | wc -l | tr -d ' ')

if [[ -z "$FILES" ]]; then
  echo "No migrations found."
  exit 0
fi

echo "📄 Found $COUNT migration(s) in $MIGRATION_DIR"

if [[ "$MODE" == "--dry-run" ]]; then
  echo "🧪 DRY RUN — wrapping in transaction + rollback"
  COMBINED=$(cat $FILES)
  WRAPPED="BEGIN; $COMBINED ROLLBACK;"
  supabase db query --linked "$WRAPPED"
  echo "✅ Dry run complete (rolled back)."
elif [[ "$MODE" == "--apply" ]]; then
  echo "🚀 APPLYING migrations..."
  for f in $FILES; do
    echo "  → $(basename "$f")"
    supabase db query --linked -f "$f"
  done
  echo "✅ All migrations applied."
else
  echo "Usage: $0 [--dry-run|--apply]"
  exit 1
fi
