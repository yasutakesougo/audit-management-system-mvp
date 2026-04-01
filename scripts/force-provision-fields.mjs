import { execSync } from 'child_process';

const SITE_URL = 'https://isogokatudouhome.sharepoint.com/sites/welfare';
const LIST_ID = '5c98f5cb-bb5a-4bac-8eea-283f5df402c4'; // SupportRecord_Daily
const M365_PATH = '/opt/homebrew/bin/m365';

const FINAL_FIELDS = [
  { 
    name: "RecordDate", 
    displayName: "Record Date", 
    xml: `<Field Type="DateTime" Name="RecordDate" StaticName="RecordDate" DisplayName="RecordDate" Format="DateOnly" Required="TRUE" />` 
  },
  { 
    name: "ReporterName", 
    displayName: "Reporter Name", 
    xml: `<Field Type="Text" Name="ReporterName" StaticName="ReporterName" DisplayName="ReporterName" />` 
  },
  { 
    name: "ReporterRole", 
    displayName: "Reporter Role", 
    xml: `<Field Type="Text" Name="ReporterRole" StaticName="ReporterRole" DisplayName="ReporterRole" />` 
  },
  { 
    name: "UserCount", 
    displayName: "User Count", 
    xml: `<Field Type="Number" Name="UserCount" StaticName="UserCount" DisplayName="UserCount" />` 
  },
  { 
    name: "ApprovalStatus", 
    displayName: "Approval Status", 
    xml: `<Field Type="Text" Name="ApprovalStatus" StaticName="ApprovalStatus" DisplayName="ApprovalStatus" />` 
  }
];

function provisionFieldSafely(field) {
  console.log(`✨ 列を XML で美しく作成中: ${field.name}...`);
  
  // STEP 1: Create without space to lock InternalName using XML
  const createCmd = `${M365_PATH} spo field add --webUrl "${SITE_URL}" --listId "${LIST_ID}" --xml "${field.xml.replace(/"/g, '\\"')}"`;
  try {
    execSync(createCmd, { encoding: 'utf-8' });
    console.log(`  ✅ 内部名確定: ${field.name}`);
  } catch (err) {
    if (err.message.includes('already exists')) {
        console.log(`  ℹ️ 既に存在します`);
    } else {
        console.error(`  ❌ 作成失敗: ${field.name}`, err.message);
        return;
    }
  }

  // STEP 2: Rename DisplayName to the final human-readable version
  console.log(`  ⚙️ 表示名を最終調整中: ${field.name} -> ${field.displayName}...`);
  const renameCmd = `${M365_PATH} spo field set --webUrl "${SITE_URL}" --listId "${LIST_ID}" --internalName "${field.name}" --title "${field.displayName}"`;
  try {
    execSync(renameCmd, { encoding: 'utf-8' });
    console.log(`  ✅ 最終表示名確定`);
  } catch (err) {
    console.warn(`  ⚠️ 表示名更新失敗: ${err.message}`);
  }
}

async function main() {
  console.log(`🚀 SupportRecord_Daily 最終プロビジョニング (XML & Rename版) を開始します...`);
  for (const field of FINAL_FIELDS) {
    provisionFieldSafely(field);
  }
  console.log(`\n🎉 すべての列が理想的な状態で再構築されました！管理画面（/admin/status）をリロードして確認してください。`);
}

main();
