#!/bin/bash
# scripts/provision-users-attendance-m365.sh
# M365 CLI based provisioning for Users_Master and AttendanceUsers

SITE_URL="https://isogokatudouhome.sharepoint.com/sites/2"
M365="/opt/homebrew/bin/m365"

# 1. Ensure Users_Master
echo "🔍 Checking Users_Master..."
LIST_EXISTS=$($M365 spo list get --webUrl "$SITE_URL" --title "Users_Master" --output none 2>&1)

if [[ $LIST_EXISTS == *"not found"* ]]; then
    # Try to rename User_Master if users_master is missing
    echo "⚠️ Users_Master not found. Checking for User_Master to rename..."
    USER_MASTER_EXISTS=$($M365 spo list get --webUrl "$SITE_URL" --title "User_Master" --output none 2>&1)
    if [[ $USER_MASTER_EXISTS != *"not found"* ]]; then
        echo "✅ Found User_Master. Renaming to Users_Master..."
        $M365 spo list set --webUrl "$SITE_URL" --title "User_Master" --newTitle "Users_Master"
    else
        echo "🛠️ Creating Users_Master list..."
        $M365 spo list add --webUrl "$SITE_URL" --title "Users_Master" --baseTemplate 100
    fi
fi

# 2. Add fields to Users_Master
echo "➕ Adding essential fields to Users_Master..."
FIELDS=(
    "UserID|利用者ID|Text"
    "FullName|氏名|Text"
    "UsageStatus|利用状況|Text"
    "ServiceEndDate|サービス終了日|DateTime"
)

for f in "${FIELDS[@]}"; do
    IFS="|" read -r INTERNAL DISPLAY TYPE <<< "$f"
    echo "  - Ensuring $INTERNAL ($DISPLAY)"
    $M365 spo field add --webUrl "$SITE_URL" --listTitle "Users_Master" --xml "<Field Type='$TYPE' Name='$INTERNAL' StaticName='$INTERNAL' DisplayName='$DISPLAY' />" 2>/dev/null || echo "    ℹ️ Field $INTERNAL already exists"
done

# 3. Ensure AttendanceUsers
echo "🔍 Checking AttendanceUsers..."
ATT_LIST_EXISTS=$($M365 spo list get --webUrl "$SITE_URL" --title "AttendanceUsers" --output none 2>&1)

if [[ $ATT_LIST_EXISTS == *"not found"* ]]; then
    echo "🛠️ Creating AttendanceUsers list..."
    $M365 spo list add --webUrl "$SITE_URL" --title "AttendanceUsers" --baseTemplate 100
fi

# 4. Add fields to AttendanceUsers
echo "➕ Adding essential fields to AttendanceUsers..."
ATT_FIELDS=(
    "UserCode|利用者コード|Text"
    "IsActive|有効|Boolean"
    "UsageStatus|利用状況|Text"
    "ServiceEndDate|利用終了日|DateTime"
)

for f in "${ATT_FIELDS[@]}"; do
    IFS="|" read -r INTERNAL DISPLAY TYPE <<< "$f"
    echo "  - Ensuring $INTERNAL ($DISPLAY)"
    $M365 spo field add --webUrl "$SITE_URL" --listTitle "AttendanceUsers" --xml "<Field Type='$TYPE' Name='$INTERNAL' StaticName='$INTERNAL' DisplayName='$DISPLAY' />" 2>/dev/null || echo "    ℹ️ Field $INTERNAL already exists"
done

echo "✅ Provisioning complete."
