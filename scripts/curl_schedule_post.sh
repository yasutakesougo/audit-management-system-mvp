#!/usr/bin/env zsh
# Usage:
# 1) Copy full Authorization header value (including the leading "Bearer ")
#    from DevTools into clipboard.
# 2) In macOS terminal: TOKEN="$(pbpaste)" ./scripts/curl_schedule_post.sh
#    Or: export TOKEN="Bearer ey..."; ./scripts/curl_schedule_post.sh

if [[ -z "${TOKEN:-}" ]]; then
  echo "TOKEN is empty. Copy full Authorization header (including 'Bearer ') into TOKEN." >&2
  echo "Example: export TOKEN=\"Bearer ey...\"" >&2
  exit 1
fi

# Basic sanity checks to avoid truncated-token mistakes
LEN=${#TOKEN}
SEGMENTS=$(echo "$TOKEN" | tr '.' '\n' | wc -l | tr -d ' ')

echo "TOKEN length: $LEN" >&2
echo "TOKEN segments: $SEGMENTS" >&2

if [[ "$SEGMENTS" -ne 3 ]]; then
  echo "TOKEN looks truncated (segments=$SEGMENTS). Copy FULL Bearer token (3 segments)." >&2
  exit 1
fi

URL="https://isogokatudouhome.sharepoint.com/sites/welfare/_api/web/lists/getbytitle('Schedules')/items"

curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -X POST "$URL" \
  -H "Accept: application/json;odata=nometadata" \
  -H "Content-Type: application/json;odata=nometadata" \
  -H "Authorization: $TOKEN" \
  --data '{
    "Title": "ターミナルテスト予定",
    "Start": "2025-11-23T01:00:00.000Z",
    "End": "2025-11-23T02:00:00.000Z",
    "Status": "Scheduled",
    "ServiceType": "normal",
    "UserCode": "U001",
    "LocationName": "テスト場所",
    "Notes": "curl から作成"
  }'
