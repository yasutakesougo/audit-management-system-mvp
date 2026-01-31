#!/bin/bash
# Schedules リストに Phase 1 必須フィールドを追加（SharePoint REST API）
# Usage: ./scripts/add-schedules-phase1-fields-rest.sh

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
  "${SITE_URL}/_api/contextinfo" \
  | jq -r '.d.GetContextWebInformation.FormDigestValue')
echo "✓ Digest取得"

echo ""
echo "=== Phase 1 必須フィールド追加: $LIST_TITLE ==="

# 1. EventDate (DateTime, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldDateTime" },
    "FieldTypeKind": 4,
    "Title": "EventDate",
    "DisplayFormat": 0,
    "Required": true
  }' > /dev/null
echo "  ✓ EventDate (DateTime, required)"

# 2. EndDate (DateTime, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldDateTime" },
    "FieldTypeKind": 4,
    "Title": "EndDate",
    "DisplayFormat": 0,
    "Required": true
  }' > /dev/null
echo "  ✓ EndDate (DateTime, required)"

# 3. Status (Choice)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldChoice" },
    "FieldTypeKind": 6,
    "Title": "Status",
    "Choices": { "results": ["Draft","Confirmed","Cancelled"] },
    "DefaultValue": "Draft"
  }' > /dev/null
echo "  ✓ Status (Choice: Draft/Confirmed/Cancelled)"

# 4. ServiceType (Choice)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldChoice" },
    "FieldTypeKind": 6,
    "Title": "ServiceType",
    "Choices": { "results": ["生活介護","就労継続支援A","就労継続支援B","就労移行","その他"] }
  }' > /dev/null
echo "  ✓ ServiceType (Choice)"

# 5. cr014_personType (Choice, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldChoice" },
    "FieldTypeKind": 6,
    "Title": "cr014_personType",
    "Choices": { "results": ["User","Staff","Org"] },
    "Required": true
  }' > /dev/null
echo "  ✓ cr014_personType (Choice: User/Staff/Org, required)"

# 6. cr014_personId (Text, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "cr014_personId",
    "Required": true
  }' > /dev/null
echo "  ✓ cr014_personId (Text, required)"

# 7. cr014_personName (Text)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "cr014_personName"
  }' > /dev/null
echo "  ✓ cr014_personName (Text)"

# 8. AssignedStaffId (Text)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "AssignedStaffId"
  }' > /dev/null
echo "  ✓ AssignedStaffId (Text)"

# 9. TargetUserId (Text)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "TargetUserId"
  }' > /dev/null
echo "  ✓ TargetUserId (Text)"

# 10. RowKey (Text, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "RowKey",
    "Required": true
  }' > /dev/null
echo "  ✓ RowKey (Text, required - GUID推奨)"

# 11. cr014_dayKey (Date, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldDateTime" },
    "FieldTypeKind": 4,
    "Title": "cr014_dayKey",
    "DisplayFormat": 1,
    "Required": true
  }' > /dev/null
echo "  ✓ cr014_dayKey (Date, required)"

# 12. MonthKey (Text, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "MonthKey",
    "Required": true
  }' > /dev/null
echo "  ✓ MonthKey (Text, required - yyyy-MM)"

# 13. cr014_fiscalYear (Text, required)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "cr014_fiscalYear",
    "Required": true
  }' > /dev/null
echo "  ✓ cr014_fiscalYear (Text, required)"

# 14. cr014_orgAudience (Text)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.Field" },
    "FieldTypeKind": 2,
    "Title": "cr014_orgAudience"
  }' > /dev/null
echo "  ✓ cr014_orgAudience (Text)"

# 15. Note (Note - multiline)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldMultiLineText" },
    "FieldTypeKind": 3,
    "Title": "Note",
    "RichText": false
  }' > /dev/null
echo "  ✓ Note (Note - multiline text)"

# 16. CreatedAt (DateTime)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldDateTime" },
    "FieldTypeKind": 4,
    "Title": "CreatedAt",
    "DisplayFormat": 0
  }' > /dev/null
echo "  ✓ CreatedAt (DateTime)"

# 17. UpdatedAt (DateTime)
curl -sS -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
  -d '{
    "__metadata": { "type": "SP.FieldDateTime" },
    "FieldTypeKind": 4,
    "Title": "UpdatedAt",
    "DisplayFormat": 0
  }' > /dev/null
echo "  ✓ UpdatedAt (DateTime)"

# 列一覧確認
echo ""
echo "=== 列一覧確認 ==="
curl -sS -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields?\$filter=Hidden eq false" \
  | jq -r '.d.results[] | select(.InternalName | IN("Title","EventDate","EndDate","Status","ServiceType","cr014_personType","cr014_personId","cr014_personName","AssignedStaffId","TargetUserId","RowKey","cr014_dayKey","MonthKey","cr014_fiscalYear","cr014_orgAudience","Note","CreatedAt","UpdatedAt")) | "\(.InternalName)\t\(.TypeAsString)\t\(.Required)\t\(.DefaultValue // "null")"' \
  | column -t -s $'\t' -N "InternalName,Type,Required,Default"

echo ""
echo "=== 完了 ==="
echo "Phase 1 必須フィールドの追加が完了しました"
echo ""
echo "次のステップ:"
echo "  1. Integration テスト実行:"
echo "     npm run test:integration -- schedules.sp.integration.spec.ts"
echo "  2. リスト動作確認:"
echo "     ${SITE_URL}/Lists/${LIST_TITLE}"
