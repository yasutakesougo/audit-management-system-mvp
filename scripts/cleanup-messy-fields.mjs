import { execSync } from 'child_process';

const SITE_URL = 'https://isogokatudouhome.sharepoint.com/sites/welfare';
const LIST_ID = '5c98f5cb-bb5a-4bac-8eea-283f5df402c4'; // SupportRecord_Daily
const M365_PATH = '/opt/homebrew/bin/m365';

const MESSY_FIELDS = [
  "Approval_x0020_Status",
  "Approval_x0020_Status0",
  "Record_x0020_Date",
  "Record_x0020_Date0",
  "Reporter_x0020_Name",
  "Reporter_x0020_Name0",
  "Reporter_x0020_Role",
  "Reporter_x0020_Role0",
  "User_x0020_Count",
  "User_x0020_Count0"
];

function deleteField(internalName) {
  console.log(`🗑️ 列を削除中: ${internalName}...`);
  // m365 spo field remove --webUrl ... --listId ... --internalName ... --force
  const cmd = `${M365_PATH} spo field remove --webUrl "${SITE_URL}" --listId "${LIST_ID}" --internalName "${internalName}" --force`;

  try {
    execSync(cmd, { encoding: 'utf-8' });
    console.log(`✅ 削除成功: ${internalName}`);
  } catch (err) {
    console.warn(`⚠️ 削除失敗（無視可能）: ${internalName} - ${err.message}`);
  }
}

async function main() {
  console.log(`🧹 SupportRecord_Daily の名称不全フィールドの一掃を開始します...`);
  for (const field of MESSY_FIELDS) {
    deleteField(field);
  }
  console.log(`\n✨ 一掃完了。次は正しい名前（RecordDate 等）で再作成します。`);
}

main();
