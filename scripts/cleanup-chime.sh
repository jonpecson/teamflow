#!/bin/bash
# Cleanup all active calls via the TeamFlow API + delete Chime meetings by ID
# Usage:
#   ./scripts/cleanup-chime.sh                    # End all via API
#   ./scripts/cleanup-chime.sh --delete-meeting MEETING_ID  # Delete specific Chime meeting
#
# Requires: JWT credentials and optionally AWS CLI

set -euo pipefail

API="${API_URL:-http://localhost:8080}"
REGION="${AWS_REGION:-us-west-2}"

if [ "${1:-}" = "--delete-meeting" ] && [ -n "${2:-}" ]; then
    echo "Deleting Chime meeting: $2"
    aws chime-sdk-meetings delete-meeting --meeting-id "$2" --region "$REGION" 2>/dev/null \
        && echo "OK - deleted" \
        || echo "FAILED (may already be expired)"
    exit 0
fi

echo "=== TeamFlow Call Cleanup ==="
echo "API: $API"
echo ""

# Prompt for credentials
read -p "Username: " USERNAME
read -s -p "Password: " PASSWORD
echo ""

# Login
TOKEN=$(curl -s "$API/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")

if [ -z "$TOKEN" ]; then
    echo "Login failed."
    exit 1
fi

# Get active calls
CALLS=$(curl -s "$API/api/calls/active" -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$CALLS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

echo "Found $COUNT active call(s)"

if [ "$COUNT" -eq 0 ]; then
    echo "Nothing to clean up."
    exit 0
fi

echo "$CALLS" | python3 -c "
import sys, json
calls = json.load(sys.stdin)
for c in calls:
    print(f'  Meeting: {c[\"meeting_id\"]}  Channel: {c[\"channel_name\"]}  By: {c[\"started_by\"]}  Participants: {\", \".join(c[\"participants\"])}')
"

echo ""
echo "Ending all $COUNT call(s)..."

echo "$CALLS" | python3 -c "
import sys, json
for c in json.load(sys.stdin):
    print(c['meeting_id'])
" | while read -r MID; do
    # Try end (creator only) then leave as fallback
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/api/calls/$MID" -H "Authorization: Bearer $TOKEN")
    if [ "$HTTP" = "200" ]; then
        echo "  Ended $MID (via DELETE)"
    else
        HTTP2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/calls/$MID/leave" -H "Authorization: Bearer $TOKEN")
        echo "  Left $MID (via leave, HTTP $HTTP2)"
    fi

    # Also try deleting the Chime meeting directly (best-effort)
    aws chime-sdk-meetings delete-meeting --meeting-id "$MID" --region "$REGION" 2>/dev/null \
        && echo "    Chime meeting deleted" \
        || echo "    Chime meeting already expired or not found"
done

echo ""
echo "Verifying..."
REMAINING=$(curl -s "$API/api/calls/active" -H "Authorization: Bearer $TOKEN")
RCOUNT=$(echo "$REMAINING" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "Remaining active calls: $RCOUNT"
echo "Done."
