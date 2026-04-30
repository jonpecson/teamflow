# Link Detector Specification

## Overview
Auto-detect URLs in chat messages and render them as clickable hyperlinks.
Applies to both channel messages and direct messages.

## Detection Rules

### Supported URL Patterns
| Pattern | Example |
|---------|---------|
| `https://` prefix | `https://example.com/path?q=1` |
| `http://` prefix | `http://localhost:3000` |
| `www.` prefix (no scheme) | `www.github.com` — rendered as `https://www.github.com` |

### URL Boundary Detection
- URL starts at scheme (`http://`, `https://`) or `www.`
- URL ends at first whitespace, or end of string
- Trailing punctuation stripped: `.` `,` `)` `]` `!` `?` `;` `:` — BUT only if not part of a balanced pair (e.g. `wiki.com/page_(foo)` keeps the closing paren)
- Handles query strings (`?key=val&k2=v2`) and fragments (`#section`)

### Exclusions
- URLs inside inline code (`` `backticks` ``) are NOT linked — displayed as code
- Bare domains without scheme or `www.` are NOT linked (e.g. `example.com` stays plain text)

## Rendering

### Display
- Rendered as `<a>` tag with `target="_blank"` and `rel="noopener noreferrer"`
- Full URL shown up to 60 characters; longer URLs truncated with `...`
- Styled with accent color, underline on hover
- Click opens in new tab

### Processing Order
1. HTML-escape the entire message text
2. Apply inline code detection (`` `code` `` blocks) — mark regions as no-link zones
3. Apply URL detection on non-code regions
4. Apply bold/italic markdown on non-code, non-link regions

## Security
- All message text is HTML-escaped BEFORE link detection
- Only `http://` and `https://` schemes allowed (no `javascript:`, `data:`, etc.)
- `rel="noopener noreferrer"` on all external links
- URLs are validated against scheme whitelist before rendering as `<a href>`

## Backend
- No backend changes needed — links are plain text in the database
- Message content validation unchanged (max 4000 chars, no empty)

## Test Cases
See `tests/link_detector_test.html` for browser-based unit tests.
