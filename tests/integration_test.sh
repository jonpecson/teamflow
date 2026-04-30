#!/usr/bin/env bash
# =============================================================================
# TeamFlow Integration Tests
# Empire Crypto Trading
# =============================================================================
# The server must already be running on localhost:8080 before executing this
# script. Use a unique timestamp suffix per run so tests are idempotent.
# =============================================================================

set -uo pipefail

BASE_URL="http://localhost:8080/api"

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

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

# ── Unique suffix keeps runs idempotent ────────────────────────────────────────
TS=$(date +%s)
ALICE="alice_${TS}"
BOB="bob_${TS}"
CAROL="carol_${TS}"
DAVE="dave_${TS}"
CHAN="test-chan-${TS}"
CHAN2="test-chan2-${TS}"

echo ""
echo "============================================================"
echo " TeamFlow Integration Test Suite"
echo " Run suffix: ${TS}"
echo " Target:     ${BASE_URL}"
echo "============================================================"
echo ""

# =============================================================================
# 1. AUTH TESTS
# =============================================================================
echo "── Auth Tests ──────────────────────────────────────────────"

# Bootstrap: Check if DB has users. If yes, login as existing user to generate invite.
# If no, first user registers without invite.
BOOTSTRAP_RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${ALICE}\",\"password\":\"password123\"}")
BOOTSTRAP_CODE=$(echo "$BOOTSTRAP_RESP" | tail -1)

BOOTSTRAP_INVITE=""
if [ "$BOOTSTRAP_CODE" = "400" ]; then
    # DB already has users — login as "alice" (seed user) to generate invite
    SEED_RESP=$(curl -s -X POST "${BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"alice","password":"password123"}')
    SEED_TOKEN=$(echo "$SEED_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)
    if [ -n "$SEED_TOKEN" ]; then
        INV_RESP=$(curl -s -X POST "${BASE_URL}/invites" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${SEED_TOKEN}" \
            -d '{"max_uses":20}')
        BOOTSTRAP_INVITE=$(echo "$INV_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['code'])" 2>/dev/null || true)
        # Now register Alice with the invite
        curl -s -o /dev/null -X POST "${BASE_URL}/auth/register" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"${ALICE}\",\"password\":\"password123\",\"invite_code\":\"${BOOTSTRAP_INVITE}\"}"
    fi
fi

# T01: Register first user (no invite code needed) — or verify bootstrap succeeded
test_name="T01: Register user (bootstrap)"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${ALICE}\",\"password\":\"password123\"}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    TOKEN_ALICE=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)
    USER_ID_ALICE=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['user_id'])" 2>/dev/null || true)
    if [ -n "$TOKEN_ALICE" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Login succeeded but no token"
    fi
else
    fail "$test_name" "Expected 200, got $http_code. Body: $body"
fi

# T02: Login with correct credentials
test_name="T02: Login with correct credentials"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${ALICE}\",\"password\":\"password123\"}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    TOKEN_ALICE=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)
    if [ -n "$TOKEN_ALICE" ]; then
        pass "$test_name"
    else
        fail "$test_name" "200 returned but no token in body: $body"
    fi
else
    fail "$test_name" "Expected 200, got $http_code. Body: $body"
fi

# T03: Login with wrong password
test_name="T03: Login with wrong password"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${ALICE}\",\"password\":\"wrongpassword\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "401" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 401, got $http_code"
fi

# T04: Login with non-existent user
test_name="T04: Login with non-existent user"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"ghost_${TS}\",\"password\":\"password123\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "401" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 401, got $http_code"
fi

# T05: Register with short username (<3 chars)
test_name="T05: Register with short username (<3 chars)"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"ab\",\"password\":\"password123\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "400" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 400, got $http_code"
fi

# T06: Register with short password (<6 chars)
test_name="T06: Register with short password (<6 chars)"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"validname_${TS}\",\"password\":\"abc\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "400" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 400, got $http_code"
fi

# T07: Register duplicate username
test_name="T07: Register duplicate username"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${ALICE}\",\"password\":\"password123\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "400" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 400, got $http_code"
fi

# T08: Register without invite code (non-first user)
test_name="T08: Register without invite code (non-first user)"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"newuser_${TS}\",\"password\":\"password123\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "400" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 400, got $http_code"
fi

echo ""

# =============================================================================
# 2. INVITE CODE TESTS
# =============================================================================
echo "── Invite Code Tests ───────────────────────────────────────"

# T09: Generate invite code
test_name="T09: Generate invite code"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/invites" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"max_uses\":5}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "201" ]; then
    INVITE_CODE=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['code'])" 2>/dev/null || true)
    INVITE_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)
    starts_with_tf=$(echo "$INVITE_CODE" | grep -c "^TF-" || true)
    if [ "$starts_with_tf" = "1" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Code '${INVITE_CODE}' does not start with TF-"
    fi
else
    fail "$test_name" "Expected 201, got $http_code. Body: $body"
    INVITE_CODE=""
    INVITE_ID=""
fi

# T10: List invite codes
test_name="T10: List invite codes"
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/invites" \
    -H "Authorization: Bearer ${TOKEN_ALICE}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    count=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
    if [ "$count" -ge "1" ] 2>/dev/null; then
        pass "$test_name"
    else
        fail "$test_name" "Expected array with >=1 items, got count=${count}. Body: $body"
    fi
else
    fail "$test_name" "Expected 200, got $http_code. Body: $body"
fi

# T11: Register new user WITH valid invite code
test_name="T11: Register new user WITH valid invite code"
if [ -n "$INVITE_CODE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${BOB}\",\"password\":\"password123\",\"invite_code\":\"${INVITE_CODE}\"}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "201" ]; then
        TOKEN_BOB=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)
        USER_ID_BOB=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['user_id'])" 2>/dev/null || true)
        pass "$test_name"
    else
        fail "$test_name" "Expected 201, got $http_code. Body: $body"
        TOKEN_BOB=""
        USER_ID_BOB=""
    fi
else
    fail "$test_name" "Skipped — no invite code from T09"
    TOKEN_BOB=""
    USER_ID_BOB=""
fi

# T12: Register with invalid/fake invite code
test_name="T12: Register with invalid/fake invite code"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"fakeinvite_${TS}\",\"password\":\"password123\",\"invite_code\":\"TF-FAKEC\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "400" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 400, got $http_code"
fi

# T13: Revoke invite code
test_name="T13: Revoke invite code"
# Generate a fresh code to revoke (so we don't break later tests)
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/invites" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"max_uses\":3}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)
REVOKE_INVITE_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)
REVOKE_INVITE_CODE=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['code'])" 2>/dev/null || true)

if [ -n "$REVOKE_INVITE_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/invites/${REVOKE_INVITE_ID}" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "200" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Could not create a code to revoke"
    REVOKE_INVITE_CODE=""
fi

# T14: Register with revoked invite code
test_name="T14: Register with revoked invite code"
if [ -n "$REVOKE_INVITE_CODE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"revokedtest_${TS}\",\"password\":\"password123\",\"invite_code\":\"${REVOKE_INVITE_CODE}\"}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "400" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 400 (revoked code), got $http_code"
    fi
else
    fail "$test_name" "Skipped — revoked code not available"
fi

# T15: Generate invite code with max_uses=1, use it, then try again → 400
test_name="T15: Invite with max_uses=1 exhausted on second use"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/invites" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"max_uses\":1}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)
ONE_USE_CODE=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['code'])" 2>/dev/null || true)

if [ -n "$ONE_USE_CODE" ]; then
    # First use (register Carol)
    curl -s -o /dev/null -X POST "${BASE_URL}/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${CAROL}\",\"password\":\"password123\",\"invite_code\":\"${ONE_USE_CODE}\"}"

    # Get Carol's token for later tests
    response_carol=$(curl -s -X POST "${BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${CAROL}\",\"password\":\"password123\"}")
    TOKEN_CAROL=$(echo "$response_carol" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)
    USER_ID_CAROL=$(echo "$response_carol" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['user_id'])" 2>/dev/null || true)

    # Second use should fail
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${DAVE}\",\"password\":\"password123\",\"invite_code\":\"${ONE_USE_CODE}\"}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "400" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 400 (exhausted), got $http_code"
    fi
else
    fail "$test_name" "Could not create single-use invite"
    TOKEN_CAROL=""
    USER_ID_CAROL=""
fi

# Register Dave with a fresh invite for later DM / channel invite tests
DAVE_INVITE_RESP=$(curl -s -X POST "${BASE_URL}/invites" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"max_uses\":2}")
DAVE_INVITE_CODE=$(echo "$DAVE_INVITE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['code'])" 2>/dev/null || true)

DAVE_REG_RESP=$(curl -s -X POST "${BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${DAVE}\",\"password\":\"password123\",\"invite_code\":\"${DAVE_INVITE_CODE}\"}")
TOKEN_DAVE=$(echo "$DAVE_REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || true)
USER_ID_DAVE=$(echo "$DAVE_REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['user_id'])" 2>/dev/null || true)

echo ""

# =============================================================================
# 3. CHANNEL TESTS
# =============================================================================
echo "── Channel Tests ───────────────────────────────────────────"

# T16: Create channel
test_name="T16: Create channel"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"name\":\"${CHAN}\"}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "201" ]; then
    CHAN_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)
    CHAN_NAME=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['name'])" 2>/dev/null || true)
    if [ "$CHAN_NAME" = "$CHAN" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected name '${CHAN}', got '${CHAN_NAME}'"
    fi
else
    fail "$test_name" "Expected 201, got $http_code. Body: $body"
    CHAN_ID=""
fi

# T17: Create duplicate channel
test_name="T17: Create duplicate channel"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"name\":\"${CHAN}\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "400" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 400, got $http_code"
fi

# T18: List channels
test_name="T18: List channels"
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels" \
    -H "Authorization: Bearer ${TOKEN_ALICE}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    is_array=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if isinstance(d,list) else 'no')" 2>/dev/null || echo "no")
    if [ "$is_array" = "yes" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected JSON array. Body: $body"
    fi
else
    fail "$test_name" "Expected 200, got $http_code"
fi

# T19: List my channels — creator is auto-joined
test_name="T19: List my channels (creator auto-joined)"
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels/mine" \
    -H "Authorization: Bearer ${TOKEN_ALICE}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ] && [ -n "$CHAN_ID" ]; then
    found=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
chan_id='${CHAN_ID}'
print('yes' if any(c['id']==chan_id for c in d) else 'no')
" 2>/dev/null || echo "no")
    if [ "$found" = "yes" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Channel ${CHAN_ID} not found in my channels. Body: $body"
    fi
else
    fail "$test_name" "Expected 200, got $http_code"
fi

# T20: Join channel (Bob joins)
test_name="T20: Join channel"
if [ -n "$CHAN_ID" ] && [ -n "$TOKEN_BOB" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/channels/${CHAN_ID}/join" \
        -H "Authorization: Bearer ${TOKEN_BOB}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "200" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing channel id or Bob token"
fi

# T21: Channel members includes joiner (Bob)
test_name="T21: Channel members includes joiner"
if [ -n "$CHAN_ID" ] && [ -n "$TOKEN_ALICE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels/${CHAN_ID}/members" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        found=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if any(m['username']=='${BOB}' for m in d) else 'no')
" 2>/dev/null || echo "no")
        if [ "$found" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Bob not found in members. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing channel id or token"
fi

# T22: Leave channel (Bob leaves)
test_name="T22: Leave channel"
if [ -n "$CHAN_ID" ] && [ -n "$TOKEN_BOB" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/channels/${CHAN_ID}/leave" \
        -H "Authorization: Bearer ${TOKEN_BOB}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "200" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing channel id or Bob token"
fi

# T23: Channel members excludes leaver (Bob)
test_name="T23: Channel members excludes leaver"
if [ -n "$CHAN_ID" ] && [ -n "$TOKEN_ALICE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels/${CHAN_ID}/members" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        found=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if any(m['username']=='${BOB}' for m in d) else 'no')
" 2>/dev/null || echo "no")
        if [ "$found" = "no" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Bob still appears in members after leaving. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing channel id or token"
fi

# T24: Create channel with invalid name (spaces)
test_name="T24: Create channel with invalid name (spaces)"
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"name\":\"bad channel name\"}")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "400" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 400, got $http_code"
fi

echo ""

# =============================================================================
# 4. MESSAGE TESTS
# =============================================================================
echo "── Message Tests ───────────────────────────────────────────"

# Create a fresh channel for message history tests
MSG_CHAN="msg-chan-${TS}"
MSG_RESP=$(curl -s -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"name\":\"${MSG_CHAN}\"}")
MSG_CHAN_ID=$(echo "$MSG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)

# Create a second separate channel that stays empty
EMPTY_CHAN="empty-chan-${TS}"
EMPTY_RESP=$(curl -s -X POST "${BASE_URL}/channels" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN_ALICE}" \
    -d "{\"name\":\"${EMPTY_CHAN}\"}")
EMPTY_CHAN_ID=$(echo "$EMPTY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)

# T25: Channel history returns 200 + valid JSON array
test_name="T25: Channel history returns 200 with valid JSON array"
if [ -n "$MSG_CHAN_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels/${MSG_CHAN_ID}/messages" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        is_array=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if isinstance(d,list) else 'no')" 2>/dev/null || echo "no")
        if [ "$is_array" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Expected JSON array. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — message channel could not be created"
fi

# T26: Channel history empty for new channel
test_name="T26: Channel history empty for new channel"
if [ -n "$EMPTY_CHAN_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels/${EMPTY_CHAN_ID}/messages" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        count=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "-1")
        if [ "$count" = "0" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Expected empty array, got count=${count}. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — empty channel could not be created"
fi

# T27: Channel history respects limit parameter (limit=0 boundary / limit query)
test_name="T27: Channel history respects limit parameter"
if [ -n "$EMPTY_CHAN_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels/${EMPTY_CHAN_ID}/messages?limit=10" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        is_array=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if isinstance(d,list) else 'no')" 2>/dev/null || echo "no")
        count=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "-1")
        if [ "$is_array" = "yes" ] && [ "$count" -le 10 ] 2>/dev/null; then
            pass "$test_name"
        else
            fail "$test_name" "Expected <=10 results, got ${count}. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — channel not available"
fi

echo ""

# =============================================================================
# 5. USER & TEAM TESTS
# =============================================================================
echo "── User & Team Tests ───────────────────────────────────────"

# T28: List all users — includes registered users
test_name="T28: List all users includes registered users"
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/users" \
    -H "Authorization: Bearer ${TOKEN_ALICE}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    found=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
usernames=[u['username'] for u in d]
print('yes' if '${ALICE}' in usernames else 'no')
" 2>/dev/null || echo "no")
    if [ "$found" = "yes" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Alice not found in user list. Body: $body"
    fi
else
    fail "$test_name" "Expected 200, got $http_code"
fi

# T29: Online users endpoint
test_name="T29: Online users endpoint returns 200"
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/online" \
    -H "Authorization: Bearer ${TOKEN_ALICE}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    is_array=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if isinstance(d,list) else 'no')" 2>/dev/null || echo "no")
    if [ "$is_array" = "yes" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected JSON array. Body: $body"
    fi
else
    fail "$test_name" "Expected 200, got $http_code"
fi

echo ""

# =============================================================================
# 6. CHANNEL INVITE TESTS
# =============================================================================
echo "── Channel Invite Tests ────────────────────────────────────"

# Ensure Alice is in CHAN (she created it, so she is; just for clarity)
# Invite Carol to CHAN (Alice invites Carol)
test_name="T30: Invite user to channel"
if [ -n "$CHAN_ID" ] && [ -n "$USER_ID_CAROL" ] && [ -n "$TOKEN_ALICE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/channels/${CHAN_ID}/invite" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN_ALICE}" \
        -d "{\"user_id\":\"${USER_ID_CAROL}\"}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        ok=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('ok') else 'no')" 2>/dev/null || echo "no")
        if [ "$ok" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "ok:true not in response. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code. Body: $body"
    fi
else
    fail "$test_name" "Skipped — missing channel id, Carol user id, or Alice token"
fi

# T31: Invite to non-existent channel
test_name="T31: Invite to non-existent channel → 404"
FAKE_UUID="00000000-0000-0000-0000-000000000000"
if [ -n "$USER_ID_CAROL" ] && [ -n "$TOKEN_ALICE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/channels/${FAKE_UUID}/invite" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN_ALICE}" \
        -d "{\"user_id\":\"${USER_ID_CAROL}\"}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "404" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 404, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing tokens"
fi

# T32: Channel members includes invited user (Carol)
test_name="T32: Channel members includes invited user"
if [ -n "$CHAN_ID" ] && [ -n "$TOKEN_ALICE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/channels/${CHAN_ID}/members" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        found=$(echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if any(m['username']=='${CAROL}' for m in d) else 'no')
" 2>/dev/null || echo "no")
        if [ "$found" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Carol not found in members after invite. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing channel id or token"
fi

echo ""

# =============================================================================
# 7. DIRECT MESSAGE TESTS
# =============================================================================
echo "── Direct Message Tests ────────────────────────────────────"

# T33: Create DM channel between Alice and Bob
test_name="T33: Create DM channel"
if [ -n "$USER_ID_BOB" ] && [ -n "$TOKEN_ALICE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/dm/${USER_ID_BOB}" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        DM_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)
        is_dm=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('is_dm') else 'no')" 2>/dev/null || echo "no")
        if [ "$is_dm" = "yes" ]; then
            pass "$test_name"
        else
            fail "$test_name" "is_dm not true in response. Body: $body"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code. Body: $body"
        DM_ID=""
    fi
else
    fail "$test_name" "Skipped — missing Bob user id or Alice token"
    DM_ID=""
fi

# T34: Re-open same DM returns same channel id
test_name="T34: Re-open same DM returns same channel"
if [ -n "$USER_ID_BOB" ] && [ -n "$TOKEN_ALICE" ] && [ -n "$DM_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/dm/${USER_ID_BOB}" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -1)

    if [ "$http_code" = "200" ]; then
        DM_ID2=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)
        if [ "$DM_ID" = "$DM_ID2" ]; then
            pass "$test_name"
        else
            fail "$test_name" "Expected same DM id '${DM_ID}', got '${DM_ID2}'"
        fi
    else
        fail "$test_name" "Expected 200, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing tokens or first DM id"
fi

# T35: Cannot DM yourself
test_name="T35: Cannot DM yourself → 400"
if [ -n "$USER_ID_ALICE" ] && [ -n "$TOKEN_ALICE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/dm/${USER_ID_ALICE}" \
        -H "Authorization: Bearer ${TOKEN_ALICE}")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "400" ]; then
        pass "$test_name"
    else
        fail "$test_name" "Expected 400, got $http_code"
    fi
else
    fail "$test_name" "Skipped — missing Alice user id or token"
fi

echo ""

# =============================================================================
# 8. HEALTH CHECK
# =============================================================================
echo "── Health Check ────────────────────────────────────────────"

# T36: GET /api/health → 200
test_name="T36: GET /api/health"
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/health")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "200" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 200, got $http_code"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "============================================================"
echo " Results: ${TOTAL} tests   ${GREEN}${PASS_COUNT} passed${NC}   ${RED}${FAIL_COUNT} failed${NC}"
echo "============================================================"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0
