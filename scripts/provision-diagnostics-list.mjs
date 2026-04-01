
import { execSync } from 'child_process';

const listName = process.env.VITE_SP_LIST_DIAGNOSTICS_REPORTS || 'Diagnostics_Reports';
// ユーザー提供の正確な URL
const siteUrl = 'https://isogokatudouhome.sharepoint.com/sites/welfare';

console.log(`Ensuring site exists: ${siteUrl}...`);
try {
  execSync(`m365 spo web get --url "${siteUrl}"`, { stdio: 'ignore' });
  console.log(`Site ${siteUrl} exists.`);
} catch (e) {
  console.log(`Site ${siteUrl} not found. Check URL!`);
  process.exit(1);
}

console.log(`Ensuring list exists: ${listName}...`);
try {
  // m365 v11.0.0 では list get は --webUrl を使用
  execSync(`m365 spo list get --webUrl "${siteUrl}" --title "${listName}"`, { stdio: 'ignore' });
  console.log(`List ${listName} already exists.`);
} catch (e) {
  console.log(`List ${listName} does not exist. Creating it...`);
  // m365 v11.0.0 では list add も --webUrl を使用、GenericList 文字列を指定
  execSync(`m365 spo list add --webUrl "${siteUrl}" --baseTemplate GenericList --title "${listName}"`, { stdio: 'inherit' });
}

console.log(`Checking/Provisioning fields for list: ${listName}...`);

const fields = [
  { name: 'Overall', xml: '<Field Type="Choice" DisplayName="Overall" Name="Overall" StaticName="Overall"><Default>pass</Default><CHOICES><CHOICE>pass</CHOICE><CHOICE>warn</CHOICE><CHOICE>fail</CHOICE></CHOICES></Field>' },
  { name: 'TopIssue', xml: '<Field Type="Text" DisplayName="Top Issue" Name="TopIssue" StaticName="TopIssue" />' },
  { name: 'SummaryText', xml: '<Field Type="Note" DisplayName="Summary Text" Name="SummaryText" StaticName="SummaryText" RichText="FALSE" />' },
  { name: 'ReportLink', xml: '<Field Type="Text" DisplayName="Report Link" Name="ReportLink" StaticName="ReportLink" />' },
  { name: 'Notified', xml: '<Field Type="Boolean" DisplayName="Notified" Name="Notified" StaticName="Notified"><Default>0</Default></Field>' },
  { name: 'NotifiedAt', xml: '<Field Type="DateTime" DisplayName="Notified At" Name="NotifiedAt" StaticName="NotifiedAt" />' }
];

for (const field of fields) {
  try {
    console.log(`Adding field: ${field.name}...`);
    // field add は --webUrl を使用
    execSync(`m365 spo field add --webUrl "${siteUrl}" --listTitle "${listName}" --xml '${field.xml}'`, { stdio: 'inherit' });
  } catch (e) {
    console.log(`Field ${field.name} might already exist or error occurred. Skipping...`);
  }
}

console.log('Provisioning completed.');
