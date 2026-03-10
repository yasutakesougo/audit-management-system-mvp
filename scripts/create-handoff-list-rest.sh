#!/bin/bash
# ============================================================
# Handoff SharePoint リスト作成スクリプト（SharePoint REST API）
#
# Usage:
#   ./scripts/create-handoff-list-rest.sh
#
# 前提条件:
#   - az login 済み
#   - jq インストール済み
#   - SharePoint サイトへの書き込み権限あり
#
# 内部名をそのまま使用するため、表示名をあとから変更しても
# アプリのコードに影響しません。
# ============================================================

set -euo pipefail

# ─── 設定 ───────────────────────────────────────────────
SITE_URL="https://isogokatudouhome.sharepoint.com/sites/welfare"
LIST_TITLE="Handoff"
SP_RESOURCE="https://isogokatudouhome.sharepoint.com"

# ─── ヘルパー関数 ───────────────────────────────────────
get_token() {
  az account get-access-token --resource "$SP_RESOURCE" --query accessToken -o tsv
}

get_digest() {
  curl -sS -X POST \
    -H "Authorization: Bearer $SP_TOKEN" \
    -H "Accept: application/json;odata=verbose" \
    -H "Content-Length: 0" \
    "${SITE_URL}/_api/contextinfo" \
    | jq -r '.d.GetContextWebInformation.FormDigestValue'
}

# テキスト列を追加
add_text_field() {
  local internal_name="$1"
  local display_name="$2"
  local required="${3:-false}"

  echo "  📝 Text: ${internal_name} (${display_name})"
  local response
  response=$(curl -sS -X POST \
    -H "Authorization: Bearer $SP_TOKEN" \
    -H "Accept: application/json;odata=verbose" \
    -H "Content-Type: application/json;odata=verbose" \
    -H "X-RequestDigest: $DIGEST" \
    "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
    -d "{
      \"__metadata\": { \"type\": \"SP.Field\" },
      \"Title\": \"${display_name}\",
      \"FieldTypeKind\": 2,
      \"StaticName\": \"${internal_name}\",
      \"InternalName\": \"${internal_name}\",
      \"Required\": ${required}
    }")

  local field_id
  field_id=$(echo "$response" | jq -r '.d.Id // empty')
  if [ -z "$field_id" ]; then
    local err
    err=$(echo "$response" | jq -r '.error.message.value // "Unknown"')
    if echo "$err" | grep -qi "already exists"; then
      echo "    ✓ 既存（スキップ）"
    else
      echo "    ⚠ エラー: $err"
    fi
  else
    echo "    ✓ 作成完了"
  fi
}

# 複数行テキスト列を追加
add_note_field() {
  local internal_name="$1"
  local display_name="$2"
  local required="${3:-false}"

  echo "  📝 Note: ${internal_name} (${display_name})"
  local response
  response=$(curl -sS -X POST \
    -H "Authorization: Bearer $SP_TOKEN" \
    -H "Accept: application/json;odata=verbose" \
    -H "Content-Type: application/json;odata=verbose" \
    -H "X-RequestDigest: $DIGEST" \
    "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
    -d "{
      \"__metadata\": { \"type\": \"SP.FieldMultiLineText\" },
      \"Title\": \"${display_name}\",
      \"FieldTypeKind\": 3,
      \"StaticName\": \"${internal_name}\",
      \"InternalName\": \"${internal_name}\",
      \"Required\": ${required},
      \"RichText\": true,
      \"NumberOfLines\": 6
    }")

  local field_id
  field_id=$(echo "$response" | jq -r '.d.Id // empty')
  if [ -z "$field_id" ]; then
    local err
    err=$(echo "$response" | jq -r '.error.message.value // "Unknown"')
    if echo "$err" | grep -qi "already exists"; then
      echo "    ✓ 既存（スキップ）"
    else
      echo "    ⚠ エラー: $err"
    fi
  else
    echo "    ✓ 作成完了"
  fi
}

# 選択肢列を追加
add_choice_field() {
  local internal_name="$1"
  local display_name="$2"
  local required="${3:-false}"
  shift 3
  local choices=("$@")

  # JSON配列を構築
  local choices_json="["
  for i in "${!choices[@]}"; do
    if [ "$i" -gt 0 ]; then choices_json+=","; fi
    choices_json+="\"${choices[$i]}\""
  done
  choices_json+="]"

  echo "  📝 Choice: ${internal_name} (${display_name})"
  local response
  response=$(curl -sS -X POST \
    -H "Authorization: Bearer $SP_TOKEN" \
    -H "Accept: application/json;odata=verbose" \
    -H "Content-Type: application/json;odata=verbose" \
    -H "X-RequestDigest: $DIGEST" \
    "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
    -d "{
      \"__metadata\": { \"type\": \"SP.FieldChoice\" },
      \"Title\": \"${display_name}\",
      \"FieldTypeKind\": 6,
      \"StaticName\": \"${internal_name}\",
      \"InternalName\": \"${internal_name}\",
      \"Required\": ${required},
      \"Choices\": { \"results\": ${choices_json} }
    }")

  local field_id
  field_id=$(echo "$response" | jq -r '.d.Id // empty')
  if [ -z "$field_id" ]; then
    local err
    err=$(echo "$response" | jq -r '.error.message.value // "Unknown"')
    if echo "$err" | grep -qi "already exists"; then
      echo "    ✓ 既存（スキップ）"
    else
      echo "    ⚠ エラー: $err"
    fi
  else
    echo "    ✓ 作成完了"
  fi
}

# 日付と時刻列を追加
add_datetime_field() {
  local internal_name="$1"
  local display_name="$2"
  local required="${3:-false}"
  local date_only="${4:-false}"

  local display_format=1  # DateOnly=0, DateTime=1
  if [ "$date_only" = "true" ]; then
    display_format=0
  fi

  echo "  📝 DateTime: ${internal_name} (${display_name})"
  local response
  response=$(curl -sS -X POST \
    -H "Authorization: Bearer $SP_TOKEN" \
    -H "Accept: application/json;odata=verbose" \
    -H "Content-Type: application/json;odata=verbose" \
    -H "X-RequestDigest: $DIGEST" \
    "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
    -d "{
      \"__metadata\": { \"type\": \"SP.FieldDateTime\" },
      \"Title\": \"${display_name}\",
      \"FieldTypeKind\": 4,
      \"StaticName\": \"${internal_name}\",
      \"InternalName\": \"${internal_name}\",
      \"Required\": ${required},
      \"DisplayFormat\": ${display_format}
    }")

  local field_id
  field_id=$(echo "$response" | jq -r '.d.Id // empty')
  if [ -z "$field_id" ]; then
    local err
    err=$(echo "$response" | jq -r '.error.message.value // "Unknown"')
    if echo "$err" | grep -qi "already exists"; then
      echo "    ✓ 既存（スキップ）"
    else
      echo "    ⚠ エラー: $err"
    fi
  else
    echo "    ✓ 作成完了"
  fi
}

# はい/いいえ列を追加
add_boolean_field() {
  local internal_name="$1"
  local display_name="$2"
  local default_value="${3:-0}"  # 0=No, 1=Yes

  echo "  📝 Boolean: ${internal_name} (${display_name})"
  local response
  response=$(curl -sS -X POST \
    -H "Authorization: Bearer $SP_TOKEN" \
    -H "Accept: application/json;odata=verbose" \
    -H "Content-Type: application/json;odata=verbose" \
    -H "X-RequestDigest: $DIGEST" \
    "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
    -d "{
      \"__metadata\": { \"type\": \"SP.Field\" },
      \"Title\": \"${display_name}\",
      \"FieldTypeKind\": 8,
      \"StaticName\": \"${internal_name}\",
      \"InternalName\": \"${internal_name}\",
      \"DefaultValue\": \"${default_value}\"
    }")

  local field_id
  field_id=$(echo "$response" | jq -r '.d.Id // empty')
  if [ -z "$field_id" ]; then
    local err
    err=$(echo "$response" | jq -r '.error.message.value // "Unknown"')
    if echo "$err" | grep -qi "already exists"; then
      echo "    ✓ 既存（スキップ）"
    else
      echo "    ⚠ エラー: $err"
    fi
  else
    echo "    ✓ 作成完了"
  fi
}

# 数値列を追加
add_number_field() {
  local internal_name="$1"
  local display_name="$2"
  local required="${3:-false}"

  echo "  📝 Number: ${internal_name} (${display_name})"
  local response
  response=$(curl -sS -X POST \
    -H "Authorization: Bearer $SP_TOKEN" \
    -H "Accept: application/json;odata=verbose" \
    -H "Content-Type: application/json;odata=verbose" \
    -H "X-RequestDigest: $DIGEST" \
    "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields" \
    -d "{
      \"__metadata\": { \"type\": \"SP.FieldNumber\" },
      \"Title\": \"${display_name}\",
      \"FieldTypeKind\": 9,
      \"StaticName\": \"${internal_name}\",
      \"InternalName\": \"${internal_name}\",
      \"Required\": ${required}
    }")

  local field_id
  field_id=$(echo "$response" | jq -r '.d.Id // empty')
  if [ -z "$field_id" ]; then
    local err
    err=$(echo "$response" | jq -r '.error.message.value // "Unknown"')
    if echo "$err" | grep -qi "already exists"; then
      echo "    ✓ 既存（スキップ）"
    else
      echo "    ⚠ エラー: $err"
    fi
  else
    echo "    ✓ 作成完了"
  fi
}

# ============================================================
# メイン処理
# ============================================================

echo "============================================"
echo "  Handoff リスト プロビジョニング"
echo "  サイト: ${SITE_URL}"
echo "============================================"
echo ""

# ─── Step 1: トークン取得 ────────────────────────────────
echo "📡 Step 1: SharePoint トークン取得中..."
SP_TOKEN=$(get_token)
echo "  ✓ Token 取得: ${#SP_TOKEN} chars"

# ─── Step 2: ダイジェスト取得 ────────────────────────────
echo ""
echo "📡 Step 2: リクエストダイジェスト取得中..."
DIGEST=$(get_digest)
echo "  ✓ Digest 取得: ${#DIGEST} chars"

# ─── Step 3: リスト作成 ─────────────────────────────────
echo ""
echo "📦 Step 3: リスト作成: ${LIST_TITLE}"
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
    \"Description\": \"申し送り（引き継ぎ）リスト — Handoff Timeline\"
  }")

LIST_ID=$(echo "$LIST_RESPONSE" | jq -r '.d.Id // empty')
if [ -z "$LIST_ID" ]; then
  ERR=$(echo "$LIST_RESPONSE" | jq -r '.error.message.value // "Unknown error"')
  if echo "$ERR" | grep -qi "already exists"; then
    echo "  ✓ リスト既存（フィールド追加を続行）"
  else
    echo "  ⚠ リスト作成失敗: $ERR"
    exit 1
  fi
else
  echo "  ✓ リスト作成完了: ${LIST_TITLE} (ID: ${LIST_ID})"
fi

# ─── Step 4: 必須列の追加 ───────────────────────────────
echo ""
echo "🔧 Step 4: 必須列の追加"

# Title は SharePoint 標準列なので表示名だけ変更
echo "  📝 Title: 表示名を 件名 に変更"
curl -sS -X PATCH \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  -H "Content-Type: application/json;odata=verbose" \
  -H "X-RequestDigest: $DIGEST" \
  -H "If-Match: *" \
  -H "X-HTTP-Method: MERGE" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields/getbytitle('Title')" \
  -d "{
    \"__metadata\": { \"type\": \"SP.Field\" },
    \"Title\": \"件名\"
  }" > /dev/null 2>&1 && echo "    ✓ Title 表示名更新" || echo "    ⚠ Title 表示名更新スキップ"

# 2. Message（複数行テキスト）
add_note_field "Message" "内容" "true"

# 3. UserCode（1行テキスト）
add_text_field "UserCode" "利用者コード" "true"

# 4. UserDisplayName（1行テキスト）
add_text_field "UserDisplayName" "利用者名" "true"

# 5. Category（選択肢）
add_choice_field "Category" "区分" "true" \
  "体調" "行動面" "家族連絡" "支援の工夫" "良かったこと" "事故・ヒヤリ" "その他"

# 6. Severity（選択肢）
add_choice_field "Severity" "重要度" "true" \
  "通常" "要注意" "重要"

# 7. Status（選択肢）
add_choice_field "Status" "状態" "true" \
  "未対応" "対応中" "対応済" "確認済" "明日へ持越" "完了"

# 8. TimeBand（選択肢）
add_choice_field "TimeBand" "時間帯" "true" \
  "朝" "午前" "午後" "夕方"

# 9. CreatedAt（日付と時刻）
add_datetime_field "CreatedAt" "作成日時（アプリ）" "true" "false"

# 10. CreatedByName（1行テキスト）
add_text_field "CreatedByName" "作成者名" "true"

# 11. IsDraft（はい/いいえ、既定値: いいえ）
add_boolean_field "IsDraft" "下書き" "0"

# ─── Step 5: 任意列の追加 ───────────────────────────────
echo ""
echo "🔧 Step 5: 任意列の追加"

# 12. MeetingSessionKey
add_text_field "MeetingSessionKey" "MeetingSessionKey" "false"

# 13. SourceType
add_text_field "SourceType" "SourceType" "false"

# 14. SourceId（数値）
add_number_field "SourceId" "SourceId" "false"

# 15. SourceUrl（1行テキスト — ハイパーリンク代替）
add_text_field "SourceUrl" "SourceUrl" "false"

# 16. SourceKey
add_text_field "SourceKey" "SourceKey" "false"

# 17. SourceLabel
add_text_field "SourceLabel" "SourceLabel" "false"

# 18. CarryOverDate（日付のみ）
add_datetime_field "CarryOverDate" "CarryOverDate" "false" "true"

# ─── Step 6: 確認 ──────────────────────────────────────
echo ""
echo "📋 Step 6: リスト列の確認"
FIELDS_RESPONSE=$(curl -sS \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Accept: application/json;odata=verbose" \
  "${SITE_URL}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields?\$filter=Hidden eq false&\$select=Title,InternalName,TypeAsString,Required" \
  | jq -r '.d.results[] | "\(.InternalName)\t\(.TypeAsString)\t\(.Required)\t\(.Title)"')

echo "  内部名           型          必須  表示名"
echo "  ─────────────   ────────    ─── ──────"
echo "$FIELDS_RESPONSE" | while IFS=$'\t' read -r iname type req title; do
  printf "  %-18s %-12s %-5s %s\n" "$iname" "$type" "$req" "$title"
done

# ─── 完了 ──────────────────────────────────────────────
echo ""
echo "============================================"
echo "  ✅ Handoff リスト プロビジョニング完了"
echo "============================================"
echo ""
echo "リスト名: ${LIST_TITLE}"
echo "URL: ${SITE_URL}/Lists/${LIST_TITLE}"
echo ""
echo "次のステップ:"
echo "  1. /admin/debug/smoke-test で存在確認"
echo "  2. /handoff-timeline で Read / Create / Update を再確認"
echo ""
