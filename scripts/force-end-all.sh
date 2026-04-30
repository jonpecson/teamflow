#!/bin/bash
# Force-end all active calls via the API.
# Usage: ./scripts/force-end-all.sh USERNAME PASSWORD
#
# Example: ./scripts/force-end-all.sh jonpecson @123qweasd

set -euo pipefail

API="${API_URL:-http://localhost:8080}"
USER="${1:?Usage: $0 USERNAME PASSWORD}"
PASS="${2:?Usage: $0 USERNAME PASSWORD}"

TOKEN=$(curl -sf "$API/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "=== Force-ending all active calls ==="
RESULT=$(curl -sf -X POST "$API/api/calls/force-end-all" -H "Authorization: Bearer $TOKEN")
echo "$RESULT" | python3 -m json.tool
