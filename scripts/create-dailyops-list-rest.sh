#!/bin/bash
# DailyOpsSignals SharePoint リスト作成スクリプト（SharePoint REST API）
# Usage: ./scripts/create-dailyops-list-rest.sh

set -e

SITE_URL="https://isogokatudouhome.sharepoint.com/sites/app-test"
LIST_TITLE="DailyOpsSignals"

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
  "${SITE_URL}/_api/contextinfo" \
  | jq -r '.d.GetContextWebInformation.FormDigestValue')
echo "✓ Digest取得完了"

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
    '__metadata': { 'type': 'SP.List' },
    'BaseTemplate': 100,
    'Title': '$LIST_TITLE',
    'Description': 'Daily operational signals for real-time status tracking'
  }")

echo "✓ リスト作成完了"

# 列作成開始
echo ""
echo "📝 列作成中..."

# 1. date (DateTime - dateOnly)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldDateTime" },
    "FieldTypeKind": 4,
    "Title": "date",
    "DisplayFormat": 1,
    "Required": true
  }' > /dev/null
echo "  ✓ date (DateTime, dateOnly, required)"

# 2. targetType (Choice)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldChoice" },
    "FieldTypeKind": 6,
    "Title": "targetType",
    "Choices": { "results": ["User","Staff","Facility","Vehicle"] }
  }' > /dev/null
echo "  ✓ targetType (Choice: User/Staff/Facility/Vehicle)"

# 3. targetId (Text, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "targetId",
    "Required": true
  }' > /dev/null
echo "  ✓ targetId (Text, required)"

# 4. kind (Choice)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldChoice" },
    "FieldTypeKind": 6,
    "Title": "kind",
    "Choices": { "results": ["EarlyLeave","Late","Absent","PickupChange","Visitor","Meeting","Other"] }
  }' > /dev/null
echo "  ✓ kind (Choice: 7 options)"

# 5. time (Text, optional)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "time"
  }' > /dev/null
echo "  ✓ time (Text, optional)"

# 6. summary (Note - 複数行テキスト)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldMultiLineText" },
    "FieldTypeKind": 3,
    "Title": "summary",
    "RichText": false
  }' > /dev/null
echo "  ✓ summary (Note - multiline text)"

# 7. status (Choice with default=Active)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldChoice" },
    "FieldTypeKind": 6,
    "Title": "status",
    "Choices": { "results": ["Active","Resolved"] },
    "DefaultValue": "Active"
  }' > /dev/null
echo "  ✓ status (Choice: Active/Resolved, default=Active)"

# 8. source (Choice with default=Other)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldChoice" },
    "FieldTypeKind": 6,
    "Title": "source",
    "Choices": { "results": ["Phone","Note","InPerson","Other"] },
    "DefaultValue": "Other"
  }' > /dev/null
echo "  ✓ source (Choice: Phone/Note/InPerson/Other, default=Other)"

echo ""
echo "=== 作成完了 ==="
echo "リスト名: $LIST_TITLE"
echo "URL: ${SITE_URL}/Lists/${LIST_TITLE}"

# 列一覧確認
echo ""
echo "📝 列一覧確認:"
curl -sS \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields?\$filter=Hidden eq false" \
  | jq -r '.d.results[] | select(.InternalName | IN("date","targetType","targetId","kind","time","summary","status","source")) | "\(.InternalName)\t\(.TypeAsString)\t\(.Required)\t\(.DefaultValue // "null")"' \
  | column -t -s $'\t' -N "InternalName,Type,Required,Default"
