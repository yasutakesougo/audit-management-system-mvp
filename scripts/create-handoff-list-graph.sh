#!/bin/bash
# ============================================================
# Handoff SharePoint リスト作成スクリプト（Microsoft Graph API）
#
# Usage:
#   ./scripts/create-handoff-list-graph.sh
#
# 前提条件:
#   - az login 済み (Sites.Manage.All 権限推奨)
#   - jq インストール済み
# ============================================================

set -euo pipefail

# ─── 設定 ───────────────────────────────────────────────
SITE_ID="isogokatudouhome.sharepoint.com,5dac33c9-5fe9-470c-bf80-77cd83f30869,99227bb3-87e3-46ea-8412-ce2155f106ee"
LIST_NAME="Handoff"
GRAPH_BASE="https://graph.microsoft.com/v1.0/sites/${SITE_ID}"

# ─── トークン取得 ──────────────────────────────────────
echo "============================================"
echo "  Handoff リスト プロビジョニング (Graph API)"
echo "============================================"
echo ""
echo "📡 トークン取得中..."
TOKEN=$(az account get-access-token --resource "https://graph.microsoft.com" --query accessToken -o tsv)
echo "  ✓ Token: ${#TOKEN} chars"

# ─── ヘルパー関数 ──────────────────────────────────────
graph_post() {
  local url="$1"
  local body="$2"
  curl -sS -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    "$url" \
    -d "$body"
}

graph_patch() {
  local url="$1"
  local body="$2"
  curl -sS -X PATCH \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    "$url" \
    -d "$body"
}

graph_get() {
  local url="$1"
  curl -sS \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json" \
    "$url"
}

# Graph API で列を追加（汎用）
add_column() {
  local col_json="$1"
  local internal_name
  internal_name=$(echo "$col_json" | jq -r '.name')

  echo -n "  📝 ${internal_name}... "
  local response
  response=$(graph_post "${GRAPH_BASE}/lists/${LIST_NAME}/columns" "$col_json")

  local col_id
  col_id=$(echo "$response" | jq -r '.id // empty')
  if [ -n "$col_id" ] && [ "$col_id" != "null" ]; then
    echo "✓ 作成完了"
  else
    local err
    err=$(echo "$response" | jq -r '.error.message // "Unknown"')
    if echo "$err" | grep -qi "already exists\|nameAlreadyExists"; then
      echo "✓ 既存（スキップ）"
    else
      echo "⚠ エラー: $err"
    fi
  fi
}

# ─── Step 1: リスト作成 ─────────────────────────────────
echo ""
echo "📦 Step 1: リスト作成: ${LIST_NAME}"

# まず既存チェック
EXISTING=$(graph_get "${GRAPH_BASE}/lists/${LIST_NAME}" 2>/dev/null | jq -r '.id // empty')
if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
  echo "  ✓ リスト既存（列追加を続行）"
else
  LIST_RESPONSE=$(graph_post "${GRAPH_BASE}/lists" "{
    \"displayName\": \"${LIST_NAME}\",
    \"list\": {
      \"template\": \"genericList\"
    }
  }")

  LIST_ID=$(echo "$LIST_RESPONSE" | jq -r '.id // empty')
  if [ -n "$LIST_ID" ] && [ "$LIST_ID" != "null" ]; then
    echo "  ✓ リスト作成完了 (ID: ${LIST_ID})"
  else
    ERR=$(echo "$LIST_RESPONSE" | jq -r '.error.message // "Unknown"')
    echo "  ⚠ リスト作成失敗: $ERR"
    exit 1
  fi
fi

# ─── Step 2: 必須列の追加 ───────────────────────────────
echo ""
echo "🔧 Step 2: 必須列の追加"

# 2. Message（複数行テキスト）
add_column '{
  "name": "Message",
  "displayName": "内容",
  "text": {
    "allowMultipleLines": true,
    "textType": "richText"
  },
  "required": true
}'

# 3. UserCode（1行テキスト）
add_column '{
  "name": "UserCode",
  "displayName": "利用者コード",
  "text": {
    "allowMultipleLines": false
  },
  "required": true
}'

# 4. UserDisplayName（1行テキスト）
add_column '{
  "name": "UserDisplayName",
  "displayName": "利用者名",
  "text": {
    "allowMultipleLines": false
  },
  "required": true
}'

# 5. Category（選択肢）
add_column '{
  "name": "Category",
  "displayName": "区分",
  "choice": {
    "allowTextEntry": false,
    "choices": ["体調", "行動面", "家族連絡", "支援の工夫", "良かったこと", "事故・ヒヤリ", "その他"],
    "displayAs": "dropDownMenu"
  },
  "required": true
}'

# 6. Severity（選択肢）
add_column '{
  "name": "Severity",
  "displayName": "重要度",
  "choice": {
    "allowTextEntry": false,
    "choices": ["通常", "要注意", "重要"],
    "displayAs": "dropDownMenu"
  },
  "required": true
}'

# 7. Status（選択肢）
add_column '{
  "name": "Status",
  "displayName": "状態",
  "choice": {
    "allowTextEntry": false,
    "choices": ["未対応", "対応中", "対応済", "確認済", "明日へ持越", "完了"],
    "displayAs": "dropDownMenu"
  },
  "required": true
}'

# 8. TimeBand（選択肢）
add_column '{
  "name": "TimeBand",
  "displayName": "時間帯",
  "choice": {
    "allowTextEntry": false,
    "choices": ["朝", "午前", "午後", "夕方"],
    "displayAs": "dropDownMenu"
  },
  "required": true
}'

# 9. CreatedAt（日付と時刻）
add_column '{
  "name": "CreatedAt",
  "displayName": "作成日時（アプリ）",
  "dateTime": {
    "displayAs": "default",
    "format": "dateTime"
  },
  "required": true
}'

# 10. CreatedByName（1行テキスト）
add_column '{
  "name": "CreatedByName",
  "displayName": "作成者名",
  "text": {
    "allowMultipleLines": false
  },
  "required": true
}'

# 11. IsDraft（はい/いいえ、既定値: いいえ）
add_column '{
  "name": "IsDraft",
  "displayName": "下書き",
  "boolean": {},
  "defaultValue": {
    "value": "false"
  }
}'

# ─── Step 3: 任意列の追加 ───────────────────────────────
echo ""
echo "🔧 Step 3: 任意列の追加"

# 12. MeetingSessionKey
add_column '{
  "name": "MeetingSessionKey",
  "displayName": "MeetingSessionKey",
  "text": { "allowMultipleLines": false }
}'

# 13. SourceType
add_column '{
  "name": "SourceType",
  "displayName": "SourceType",
  "text": { "allowMultipleLines": false }
}'

# 14. SourceId（数値）
add_column '{
  "name": "SourceId",
  "displayName": "SourceId",
  "number": {}
}'

# 15. SourceUrl（1行テキスト）
add_column '{
  "name": "SourceUrl",
  "displayName": "SourceUrl",
  "text": { "allowMultipleLines": false }
}'

# 16. SourceKey
add_column '{
  "name": "SourceKey",
  "displayName": "SourceKey",
  "text": { "allowMultipleLines": false }
}'

# 17. SourceLabel
add_column '{
  "name": "SourceLabel",
  "displayName": "SourceLabel",
  "text": { "allowMultipleLines": false }
}'

# 18. CarryOverDate（日付のみ）
add_column '{
  "name": "CarryOverDate",
  "displayName": "CarryOverDate",
  "dateTime": {
    "displayAs": "default",
    "format": "dateOnly"
  }
}'

# ─── Step 4: 確認 ──────────────────────────────────────
echo ""
echo "📋 Step 4: リスト列の確認"

COLUMNS=$(graph_get "${GRAPH_BASE}/lists/${LIST_NAME}/columns?\$select=name,displayName,required,text,choice,dateTime,boolean,number" | jq -r '
  .value[] |
  select(.name != null) |
  "\(.name)\t\(.displayName // "-")\t\(.required // false)"
')

echo ""
echo "  内部名                表示名              必須"
echo "  ──────────────────  ──────────────────  ────"
echo "$COLUMNS" | while IFS=$'\t' read -r name disp req; do
  printf "  %-22s %-20s %s\n" "$name" "$disp" "$req"
done

# ─── 完了 ──────────────────────────────────────────────
echo ""
echo "============================================"
echo "  ✅ Handoff リスト プロビジョニング完了"
echo "============================================"
echo ""
echo "次のステップ:"
echo "  1. /admin/debug/smoke-test で存在確認"
echo "  2. /handoff-timeline で Read / Create / Update を再確認"
echo ""
