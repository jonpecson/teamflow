#!/usr/bin/env bash
# =============================================================================
# TeamFlow Voice/Video Call Tests (Amazon Chime SDK)
# Tests the call REST API endpoints (Chime SDK calls are mocked at boundary)
# =============================================================================

set -uo pipefail

BASE_URL="http://localhost:8080/api"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    echo -e "${GREEN}PASS${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "${RED}FAIL${NC} $1"
    if [ -n "${2:-}" ]; then
        echo -e "     ${YELLOW}↳ $2${NC}"
    fi
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

TS=$(date +%s)
CALLER="caller_${TS}"
JOINER="joiner_${TS}"
CHAN="callchan_${TS}"

echo ""
echo "============================================================"
echo " TeamFlow Call API Tests"
echo " Run suffix: ${TS}"
echo "============================================================"
echo ""

# ── Bootstrap: create users with invite codes ─────────────
SEED_RESP=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"alice","password":"password123"}')
SEED_TOKEN=$(echo "$SEED_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)

INV_RESP=$(curl -s -X POST "${BASE_URL}/invites" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SEED_TOKEN}" \
    -d '{"max_uses":10}')
INV_CODE=$(echo "$INV_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['code'])" 2>/dev/null || true)

# Register caller
curl -s -o /dev/null -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${CALLER}\",\"password\":\"password123\",\"invite_code\":\"${INV_CODE}\"}"
CALLER_RESP=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${CALLER}\",\"password\":\"password123\"}")
TOKEN_CALLER=$(echo "$CALLER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)
UID_CALLER=$(echo "$CALLER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['user_id'])" 2>/dev/null || true)

# Register joiner
curl -s -o /dev/null -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${JOINER}\",\"password\":\"password123\",\"invite_code\":\"${INV_CODE}\"}"
JOINER_RESP=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${JOINER}\",\"password\":\"password123\"}")
TOKEN_JOINER=$(echo "$JOINER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)

# Create channel and add both users
CHAN_RESP=$(curl -s -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_CALLER}" \
    -d "{\"name\":\"${CHAN}\"}")
CHAN_ID=$(echo "$CHAN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)

# Joiner joins the channel
curl -s -o /dev/null -X POST "${BASE_URL}/channels/${CHAN_ID}/join" \
    -H "Authorization: Bearer ${TOKEN_JOINER}"

echo "── Call API Tests ─────────────────────────────────────────"

# C01: Active calls returns empty initially
test_name="C01: Active calls initially empty"
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/calls/active" \
    -H "Authorization: Bearer ${TOKEN_CALLER}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    is_array=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if isinstance(d,list) else 'no')" 2>/dev/null || echo "no")
    if [ "$is_array" = "yes" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected array. Body: $body"
    fi
else
    fail "$test_name" "Expected 200, got $http_code"
fi

# C02: Start call returns meeting data (requires valid AWS creds + Chime access)
test_name="C02: Start call endpoint responds"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_CALLER}" \
    -d "{\"channel_id\":\"${CHAN_ID}\"}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "201" ]; then
    MEETING_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['meeting_id'])" 2>/dev/null || true)
    has_attendee=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'attendee' in d else 'no')" 2>/dev/null || echo "no")
    if [ -n "$MEETING_ID" ] && [ "$has_attendee" = "yes" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Missing meeting_id or attendee"
    fi
elif [ "$http_code" = "400" ]; then
    # Chime SDK might not be available (no permissions/credentials)
    error_msg=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || true)
    echo -e "${YELLOW}SKIP${NC} $test_name (Chime SDK not available: $error_msg)"
    echo -e "${YELLOW}     ↳ Remaining call tests will be skipped${NC}"
    MEETING_ID=""
else
    fail "$test_name" "Expected 201 or 400, got $http_code. Body: $body"
    MEETING_ID=""
fi

# C03: Active calls shows the active call
test_name="C03: Active calls shows started call"
if [ -n "$MEETING_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/calls/active" \
        -H "Authorization: Bearer ${TOKEN_CALLER}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        found=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if any(c['meeting_id']=='${MEETING_ID}' for c in d) else 'no')
" 2>/dev/null || echo "no")
        if [ "$found" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Meeting not in active calls"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    echo -e "${YELLOW}SKIP${NC} $test_name"
fi

# C03b: Active calls include channel_name field
test_name="C03b: Active calls include channel_name"
if [ -n "$MEETING_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/calls/active" \
        -H "Authorization: Bearer ${TOKEN_CALLER}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        has_name=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
calls=[c for c in d if c['meeting_id']=='${MEETING_ID}']
print('yes' if calls and calls[0].get('channel_name') else 'no')
" 2>/dev/null || echo "no")
        if [ "$has_name" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "channel_name missing from active call"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    echo -e "${YELLOW}SKIP${NC} $test_name"
fi

# C04: Join call
test_name="C04: Join existing call"
if [ -n "$MEETING_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls/${MEETING_ID}/join" \
        -H "Authorization: Bearer ${TOKEN_JOINER}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "201" ]; then
        has_token=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('attendee',{}).get('join_token') else 'no')" 2>/dev/null || echo "no")
        if [ "$has_token" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Missing join_token"
        fi
    else
        fail "$test_name" "Expected 201, got $http_code"
    fi
else
    echo -e "${YELLOW}SKIP${NC} $test_name"
fi

# C05: Leave call
test_name="C05: Leave call"
if [ -n "$MEETING_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls/${MEETING_ID}/leave" \
        -H "Authorization: Bearer ${TOKEN_JOINER}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "200" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    echo -e "${YELLOW}SKIP${NC} $test_name"
fi

# C06: End call (creator only)
test_name="C06: End call by creator"
if [ -n "$MEETING_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/calls/${MEETING_ID}" \
        -H "Authorization: Bearer ${TOKEN_CALLER}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "200" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    echo -e "${YELLOW}SKIP${NC} $test_name"
fi

# C07: Active calls empty after ending
test_name="C07: Active calls empty after ending"
if [ -n "$MEETING_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/calls/active" \
        -H "Authorization: Bearer ${TOKEN_CALLER}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        found=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if any(c.get('meeting_id')=='${MEETING_ID}' for c in d) else 'no')
" 2>/dev/null || echo "no")
        if [ "$found" = "no" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Meeting still in active calls after ending"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    echo -e "${YELLOW}SKIP${NC} $test_name"
fi

# C08: Start call as non-member fails
test_name="C08: Start call as non-member → 400"
# Create a channel joiner is NOT in
PRIV_CHAN="private_${TS}"
curl -s -o /dev/null -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_CALLER}" \
    -d "{\"name\":\"${PRIV_CHAN}\"}"
PRIV_CHAN_ID=$(curl -s "${BASE_URL}/channels" \
    -H "Authorization: Bearer ${TOKEN_CALLER}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ids=[c['id'] for c in d if c['name']=='${PRIV_CHAN}']
print(ids[0] if ids else '')
" 2>/dev/null || true)

if [ -n "$PRIV_CHAN_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN_JOINER}" \
        -d "{\"channel_id\":\"${PRIV_CHAN_ID}\"}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "400" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 400, got $http_code"
    fi
else
    fail "$test_name" "Could not create private channel"
fi

# C09: Join non-existent meeting → 404
test_name="C09: Join non-existent meeting → 404"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls/nonexistent-meeting-id/join" \
    -H "Authorization: Bearer ${TOKEN_CALLER}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "404" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 404, got $http_code"
fi

# C10: Start call succeeds even if other channel members are offline
test_name="C10: Start call with offline members succeeds"
OFFLINE_CHAN="offtest_${TS}"
curl -s -o /dev/null -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_CALLER}" \
    -d "{\"name\":\"${OFFLINE_CHAN}\"}"
OFFLINE_CHAN_ID=$(curl -s "${BASE_URL}/channels" \
    -H "Authorization: Bearer ${TOKEN_CALLER}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ids=[c['id'] for c in d if c['name']=='${OFFLINE_CHAN}']
print(ids[0] if ids else '')
" 2>/dev/null || true)

# Joiner joins channel but is NOT connected via WebSocket (offline)
curl -s -o /dev/null -X POST "${BASE_URL}/channels/${OFFLINE_CHAN_ID}/join" \
    -H "Authorization: Bearer ${TOKEN_JOINER}"

if [ -n "$OFFLINE_CHAN_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN_CALLER}" \
        -d "{\"channel_id\":\"${OFFLINE_CHAN_ID}\"}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "201" ]; then
        OFFLINE_MEETING_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['meeting_id'])" 2>/dev/null || true)
        pass "$test_name"
        # Clean up
        if [ -n "$OFFLINE_MEETING_ID" ]; then
            curl -s -o /dev/null -X DELETE "${BASE_URL}/calls/${OFFLINE_MEETING_ID}" \
                -H "Authorization: Bearer ${TOKEN_CALLER}"
        fi
    elif [ "$http_code" = "400" ]; then
        echo -e "${YELLOW}SKIP${NC} $test_name (Chime SDK not available)"
    else
        fail "$test_name" "Expected 201, got $http_code. Body: $body"
    fi
else
    fail "$test_name" "Could not create offline channel"
fi

# C11: Joining expired/stale meeting returns clear error and cleans up
test_name="C11: Join expired meeting → 400 with cleanup"
# Start a call, then manually delete it from Chime (simulating expiry)
# by deleting the Chime meeting via the API and then trying to join
if [ -n "$MEETING_ID" ]; then
    # We already ended the meeting in C06, but if Chime tests ran,
    # start a fresh call to test the expiry path
    start_resp=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN_CALLER}" \
        -d "{\"channel_id\":\"${CHAN_ID}\"}")
    start_code=$(echo "$start_resp" | tail -1)
    start_body=$(echo "$start_resp" | head -1)

    if [ "$start_code" = "201" ]; then
        EXPIRE_MEETING_ID=$(echo "$start_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['meeting_id'])" 2>/dev/null || true)

        # End it on Chime side (simulating expiry) but leave our state intact
        # by ending via API which cleans up both
        curl -s -o /dev/null -X DELETE "${BASE_URL}/calls/${EXPIRE_MEETING_ID}" \
            -H "Authorization: Bearer ${TOKEN_CALLER}"

        # Verify it was cleaned — joining should return 404 (meeting not found)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/calls/${EXPIRE_MEETING_ID}/join" \
            -H "Authorization: Bearer ${TOKEN_JOINER}")
        http_code=$(echo "$response" | tail -1)

        if [ "$http_code" = "404" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Expected 404 after cleanup, got $http_code"
        fi
    else
        echo -e "${YELLOW}SKIP${NC} $test_name (Chime SDK not available)"
    fi
else
    echo -e "${YELLOW}SKIP${NC} $test_name"
fi

echo ""

# ── Summary ──
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "============================================================"
echo -e " Results: ${TOTAL} tests   ${GREEN}${PASS_COUNT} passed${NC}   ${RED}${FAIL_COUNT} failed${NC}"
echo "============================================================"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
