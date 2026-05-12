import { execSync } from 'child_process';

const siteUrl = 'https://isogokatudouhome.sharepoint.com/sites/welfare';
const abcListName = 'AbcBehaviorRecords';
const rowsListName = 'DailyRecordRows';

console.log(`🔍 SharePoint URL in use: ${siteUrl}`);

// 1. Ensure connectivity
try {
  console.log('📡 Verifying M365 CLI connection status...');
  execSync(`m365 spo web get --url "${siteUrl}"`, { stdio: 'ignore' });
  console.log('✅ Connected successfully to SharePoint.');
} catch (err) {
  console.error('❌ M365 CLI verification failed. Please make sure you are logged in (m365 login).');
  process.exit(1);
}

// 2. Ensure AbcBehaviorRecords list exists
console.log(`\n📦 Checking if list "${abcListName}" exists...`);
let abcListExists = false;
try {
  execSync(`m365 spo list get --webUrl "${siteUrl}" --title "${abcListName}"`, { stdio: 'ignore' });
  console.log(`✅ List "${abcListName}" already exists.`);
  abcListExists = true;
} catch {
  console.log(`ℹ️ List "${abcListName}" does not exist. Creating it...`);
  try {
    execSync(`m365 spo list add --webUrl "${siteUrl}" --baseTemplate GenericList --title "${abcListName}"`, { stdio: 'inherit' });
    console.log(`✅ List "${abcListName}" created successfully.`);
    abcListExists = true;
  } catch (err) {
    console.error(`❌ Failed to create list "${abcListName}":`, err.message);
    process.exit(1);
  }
}

// 3. Provision fields for AbcBehaviorRecords
if (abcListExists) {
  console.log(`\n⚙️ Checking/Provisioning fields for list: ${abcListName}...`);

  const abcFields = [
    { name: 'AbcRecordId', displayName: 'ABC記録ID (UUID)', xml: '<Field Type="Text" Name="AbcRecordId" StaticName="AbcRecordId" DisplayName="AbcRecordId" Required="TRUE" Indexed="TRUE" />' },
    { name: 'UserId', displayName: '利用者コード', xml: '<Field Type="Text" Name="UserId" StaticName="UserId" DisplayName="UserId" Required="TRUE" Indexed="TRUE" />' },
    { name: 'RecordDate', displayName: '記録日', xml: '<Field Type="DateTime" Name="RecordDate" StaticName="RecordDate" DisplayName="RecordDate" Format="DateOnly" Required="TRUE" Indexed="TRUE" />' },
    { name: 'OccurredAt', displayName: '発生時刻', xml: '<Field Type="Text" Name="OccurredAt" StaticName="OccurredAt" DisplayName="OccurredAt" />' },
    { name: 'Setting', displayName: '環境・状況(S)', xml: '<Field Type="Text" Name="Setting" StaticName="Setting" DisplayName="Setting" />' },
    { name: 'Antecedent', displayName: '直前の状況(A)', xml: '<Field Type="Note" Name="Antecedent" StaticName="Antecedent" DisplayName="Antecedent" RichText="FALSE" />' },
    { name: 'Behavior', displayName: '行動の様子(B)', xml: '<Field Type="Note" Name="Behavior" StaticName="Behavior" DisplayName="Behavior" RichText="FALSE" Required="TRUE" />' },
    { name: 'Consequence', displayName: '直後の結果(C)', xml: '<Field Type="Note" Name="Consequence" StaticName="Consequence" DisplayName="Consequence" RichText="FALSE" />' },
    { name: 'Intensity', displayName: '強度', xml: '<Field Type="Text" Name="Intensity" StaticName="Intensity" DisplayName="Intensity" />' },
    { name: 'DurationMinutes', displayName: '継続時間(分)', xml: '<Field Type="Number" Name="DurationMinutes" StaticName="DurationMinutes" DisplayName="DurationMinutes" />' },
    { name: 'RiskFlag', displayName: '自他害・物損フラグ', xml: '<Field Type="Boolean" Name="RiskFlag" StaticName="RiskFlag" DisplayName="RiskFlag" />' },
    { name: 'TagsJson', displayName: 'タグJSON', xml: '<Field Type="Note" Name="TagsJson" StaticName="TagsJson" DisplayName="TagsJson" RichText="FALSE" />' },
    { name: 'Notes', displayName: '備考・特記事項', xml: '<Field Type="Note" Name="Notes" StaticName="Notes" DisplayName="Notes" RichText="FALSE" />' },
    { name: 'SourcePage', displayName: '遷移元画面', xml: '<Field Type="Text" Name="SourcePage" StaticName="SourcePage" DisplayName="SourcePage" />' },
    { name: 'SourceDate', displayName: '遷移元日付', xml: '<Field Type="Text" Name="SourceDate" StaticName="SourceDate" DisplayName="SourceDate" />' },
    { name: 'SourceSlotId', displayName: '遷移元スロットID', xml: '<Field Type="Text" Name="SourceSlotId" StaticName="SourceSlotId" DisplayName="SourceSlotId" />' },
    { name: 'SourceSlotLabel', displayName: '遷移元スロット名', xml: '<Field Type="Text" Name="SourceSlotLabel" StaticName="SourceSlotLabel" DisplayName="SourceSlotLabel" />' },
    { name: 'ReturnUrl', displayName: '戻り先URL', xml: '<Field Type="Text" Name="ReturnUrl" StaticName="ReturnUrl" DisplayName="ReturnUrl" />' },
    { name: 'RecorderName', displayName: '記録者氏名', xml: '<Field Type="Text" Name="RecorderName" StaticName="RecorderName" DisplayName="RecorderName" />' },
    { name: 'CreatedByCode', displayName: '作成者コード', xml: '<Field Type="Text" Name="CreatedByCode" StaticName="CreatedByCode" DisplayName="CreatedByCode" Required="TRUE" />' },
    { name: 'UpdatedByCode', displayName: '更新者コード', xml: '<Field Type="Text" Name="UpdatedByCode" StaticName="UpdatedByCode" DisplayName="UpdatedByCode" />' },
    { name: 'CreatedAt', displayName: '作成日時', xml: '<Field Type="Text" Name="CreatedAt" StaticName="CreatedAt" DisplayName="CreatedAt" Required="TRUE" />' },
    { name: 'UpdatedAt', displayName: '更新日時', xml: '<Field Type="Text" Name="UpdatedAt" StaticName="UpdatedAt" DisplayName="UpdatedAt" />' },
    { name: 'IsDeleted', displayName: '論理削除フラグ', xml: '<Field Type="Boolean" Name="IsDeleted" StaticName="IsDeleted" DisplayName="IsDeleted" />' },
    { name: 'DeletedAt', displayName: '削除日時', xml: '<Field Type="Text" Name="DeletedAt" StaticName="DeletedAt" DisplayName="DeletedAt" />' },
    { name: 'DeletedByCode', displayName: '削除者コード', xml: '<Field Type="Text" Name="DeletedByCode" StaticName="DeletedByCode" DisplayName="DeletedByCode" />' }
  ];

  for (const field of abcFields) {
    try {
      console.log(`✨ Creating field: ${field.name}...`);
      execSync(`m365 spo field add --webUrl "${siteUrl}" --listTitle "${abcListName}" --xml "${field.xml.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
      console.log(`  ✅ Field "${field.name}" created.`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ℹ️ Field "${field.name}" already exists.`);
      } else {
        console.warn(`  ⚠️ Error adding field "${field.name}":`, err.message);
      }
    }

    // Adjust title/displayName
    try {
      execSync(`m365 spo field set --webUrl "${siteUrl}" --listTitle "${abcListName}" --internalName "${field.name}" --title "${field.displayName}"`, { stdio: 'ignore' });
      console.log(`  ✅ Field "${field.name}" display name set to "${field.displayName}".`);
    } catch (err) {
      console.warn(`  ⚠️ Error updating display name for "${field.name}":`, err.message);
    }
  }
}

// 4. Ensure RowNo column is added to DailyRecordRows list
console.log(`\n📦 Checking list "${rowsListName}" for column "RowNo"...`);
const rowNoField = {
  name: 'RowNo',
  displayName: 'Row No',
  xml: '<Field Type="Number" Name="RowNo" StaticName="RowNo" DisplayName="RowNo" />'
};

try {
  console.log(`✨ Creating "RowNo" field inside "${rowsListName}"...`);
  execSync(`m365 spo field add --webUrl "${siteUrl}" --listTitle "${rowsListName}" --xml "${rowNoField.xml.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
  console.log(`  ✅ Field "${rowNoField.name}" created.`);
} catch (err) {
  if (err.message.includes('already exists')) {
    console.log(`  ℹ️ Field "${rowNoField.name}" already exists.`);
  } else {
    console.warn(`  ⚠️ Error adding field "${rowNoField.name}":`, err.message);
  }
}

try {
  console.log(`  ⚙️ Setting display name for "RowNo" to "Row No"...`);
  execSync(`m365 spo field set --webUrl "${siteUrl}" --listTitle "${rowsListName}" --internalName "${rowNoField.name}" --title "${rowNoField.displayName}"`, { stdio: 'ignore' });
  console.log(`  ✅ "RowNo" display name set to "${rowNoField.displayName}".`);
} catch (err) {
  console.warn(`  ⚠️ Error updating display name for "RowNo":`, err.message);
}

console.log('\n🎉 Reconcile process completed successfully! Please re-run the diagnostic checks to confirm.');
