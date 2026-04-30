#!/usr/bin/env bash
# =============================================================================
# TeamFlow Link Detector Tests
# =============================================================================

set -uo pipefail

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

# Run detectLinks via Node.js, passing input as env var to avoid shell escaping issues
run_detect() {
    INPUT="$1" node --input-type=module -e '
function esc(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function detectLinks(escaped) {
    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    return escaped.replace(urlRegex, function(match) {
        let url = match;
        let trailing = "";
        const openParens = (url.match(/\(/g) || []).length;
        const closeParens = (url.match(/\)/g) || []).length;
        while (url.length > 0) {
            const last = url[url.length - 1];
            if (".,!?;:".includes(last)) {
                trailing = last + trailing;
                url = url.slice(0, -1);
            } else if (last === ")" && closeParens > openParens) {
                trailing = last + trailing;
                url = url.slice(0, -1);
                break;
            } else if (last === "]") {
                trailing = last + trailing;
                url = url.slice(0, -1);
            } else {
                break;
            }
        }
        let href = url;
        if (href.match(/^www\./i)) { href = "https://" + href; }
        if (!href.match(/^https?:\/\//i)) { return match; }
        let display = url;
        if (display.length > 60) { display = display.substring(0, 57) + "..."; }
        return "<a href=\"" + href + "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"msg-link\">" + display + "</a>" + trailing;
    });
}
const input = process.env.INPUT;
const escaped = esc(input);
process.stdout.write(detectLinks(escaped));
'
}

echo ""
echo "============================================================"
echo " TeamFlow Link Detector Tests"
echo "============================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: node is required${NC}"
    exit 1
fi

# ── Basic URL Detection ──
echo "── Basic URL Detection ─────────────────────────────────────"

test_name="L01: Simple https URL"
result=$(run_detect "Check https://example.com")
if echo "$result" | grep -q 'href="https://example.com"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L02: Simple http URL"
result=$(run_detect "Visit http://localhost:3000")
if echo "$result" | grep -q 'href="http://localhost:3000"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L03: www URL gets https scheme"
result=$(run_detect "Go to www.github.com")
if echo "$result" | grep -q 'href="https://www.github.com"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L04: URL with path"
result=$(run_detect "See https://docs.rs/axum/latest/")
if echo "$result" | grep -q 'href="https://docs.rs/axum/latest/"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L05: URL with query string"
result=$(run_detect "Search https://google.com/search?q=rust")
if echo "$result" | grep -q 'href="https://google.com/search?q=rust"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L06: URL with fragment"
result=$(run_detect "Read https://example.com/page#section")
if echo "$result" | grep -q 'href="https://example.com/page#section"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

echo ""
echo "── Trailing Punctuation ────────────────────────────────────"

test_name="L07: URL followed by period"
result=$(run_detect "Visit https://example.com.")
if echo "$result" | grep -q 'href="https://example.com"' && echo "$result" | grep -q '</a>\.'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L08: URL followed by comma"
result=$(run_detect "Links: https://a.com, done")
if echo "$result" | grep -q 'href="https://a.com"' && echo "$result" | grep -q '</a>,'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L09: URL followed by exclamation"
result=$(run_detect "Wow https://cool.io!")
if echo "$result" | grep -q 'href="https://cool.io"' && echo "$result" | grep -q '</a>!'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L10: URL followed by question mark"
result=$(run_detect "Is it https://example.com?")
if echo "$result" | grep -q 'href="https://example.com"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

echo ""
echo "── Balanced Parentheses ────────────────────────────────────"

test_name="L11: Wikipedia URL with parens preserved"
result=$(run_detect "https://en.wikipedia.org/wiki/Rust_(programming_language)")
if echo "$result" | grep -q 'Rust_(programming_language)'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L12: URL in parentheses — trailing paren stripped"
result=$(run_detect "(see https://example.com)")
if echo "$result" | grep -q 'href="https://example.com"' && echo "$result" | grep -q '</a>)'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

echo ""
echo "── Multiple URLs ─────────────────────────────────────────"

test_name="L13: Two URLs in one message"
result=$(run_detect "Try https://a.com and https://b.com")
count=$(echo "$result" | grep -o 'href=' | wc -l | tr -d ' ')
if [ "$count" = "2" ]; then
    pass "$test_name"
else
    fail "$test_name" "Expected 2 links, got $count"
fi

echo ""
echo "── No False Positives ────────────────────────────────────"

test_name="L14: Bare domain not linked"
result=$(run_detect "Visit example.com for info")
if echo "$result" | grep -q 'href='; then
    fail "$test_name" "Bare domain should not be linked"
else
    pass "$test_name"
fi

test_name="L15: Plain text stays plain"
result=$(run_detect "Hello world, no links here!")
if echo "$result" | grep -q 'href='; then
    fail "$test_name" "Should have no links"
else
    pass "$test_name"
fi

test_name="L16: Email not linked"
result=$(run_detect "Contact user@example.com")
if echo "$result" | grep -q 'href='; then
    fail "$test_name" "Email should not be linked"
else
    pass "$test_name"
fi

echo ""
echo "── Long URL Truncation ─────────────────────────────────────"

test_name="L17: Long URL truncated in display"
result=$(run_detect "https://example.com/very/long/path/that/exceeds/sixty/characters/in/total")
if echo "$result" | grep -q '\.\.\.'; then
    pass "$test_name"
else
    fail "$test_name" "Expected '...' truncation. Got: $result"
fi

echo ""
echo "── URL Boundaries ────────────────────────────────────────"

test_name="L18: URL at start of message"
result=$(run_detect "https://start.com is great")
if echo "$result" | grep -q 'href="https://start.com"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L19: URL at end of message"
result=$(run_detect "Check this: https://end.com")
if echo "$result" | grep -q 'href="https://end.com"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

test_name="L20: URL is entire message"
result=$(run_detect "https://only.com/path")
if echo "$result" | grep -q 'href="https://only.com/path"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
fi

echo ""
echo "── Security ──────────────────────────────────────────────"

test_name="L21: target=_blank and rel=noopener present"
result=$(run_detect "https://example.com")
if echo "$result" | grep -q 'target="_blank"' && echo "$result" | grep -q 'rel="noopener noreferrer"'; then
    pass "$test_name"
else
    fail "$test_name" "Missing attributes. Got: $result"
fi

test_name="L22: HTML in surrounding text is escaped"
result=$(run_detect '<script>alert(1)</script> https://safe.com')
if echo "$result" | grep -q '&lt;script&gt;' && echo "$result" | grep -q 'href="https://safe.com"'; then
    pass "$test_name"
else
    fail "$test_name" "Got: $result"
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
