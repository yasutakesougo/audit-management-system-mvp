#!/bin/bash
# Schedules SharePoint リスト作成スクリプト（SharePoint REST API）
# Usage: ./scripts/create-schedules-list-rest.sh

set -e

SITE_URL="https://isogokatudouhome.sharepoint.com/sites/app-test"
LIST_TITLE="Schedules"

# SharePoint用トークン取得
echo "📝 SharePoint トークン取得中..."
SP_TOKEN=$(az account get-access-token --resource "https://isogokatudouhome.sharepoint.com" --query accessToken -o tsv)
echo "✓ Token取得: ${#SP_TOKEN} chars"

# リクエストダイジェスト取得
echo ""
echo "📝 リクエストダイジェスト取得中..."
DIGEST=$(curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Length: 0" \
  "${SITE_URL}/_api/contextinfo" \
  | jq -r '.d.GetContextWebInformation.FormDigestValue')
echo "✓ Digest取得: ${#DIGEST} chars"

# リスト作成
echo ""
echo "📝 リスト作成: $LIST_TITLE"
LIST_RESPONSE=$(curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists" \
  -d "{
    \"__metadata\": { \"type\": \"SP.List\" },
    \"BaseTemplate\": 100,
    \"Title\": \"${LIST_TITLE}\",
    \"Description\": \"Schedule list for integrated resource calendar\"
  }")

# リスト作成確認
LIST_ID=$(echo "$LIST_RESPONSE" | jq -r '.d.Id // empty')
if [ -z "$LIST_ID" ]; then
  echo "⚠ リスト作成失敗 or 既存"
  echo "$LIST_RESPONSE" | jq -r '.error.message.value // "Unknown error"'
  exit 1
fi

echo "✓ リスト作成完了: $LIST_TITLE (ID: $LIST_ID)"

echo ""
echo "=== 完了 ==="
echo "リスト名: $LIST_TITLE"
echo "URL: $SITE_URL/Lists/$LIST_TITLE"
echo ""
echo "次のステップ:"
echo "  1. Phase 1 必須フィールドを追加:"
echo "     ./scripts/add-schedules-phase1-fields-rest.sh"
echo "  2. リスト確認:"
echo "     curl -H \"Authorization: Bearer \$SP_TOKEN\" \"${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')\""
