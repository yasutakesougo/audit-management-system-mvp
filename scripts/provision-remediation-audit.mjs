
import { execSync } from 'child_process';

const listName = process.env.VITE_SP_LIST_REMEDIATION_AUDIT_LOG || 'RemediationAuditLog';
const siteUrl = 'https://isogokatudouhome.sharepoint.com/sites/welfare';

console.log(`Ensuring site exists: ${siteUrl}...`);
try {
  execSync(`m365 spo web get --url "${siteUrl}"`, { stdio: 'ignore' });
  console.log(`Site ${siteUrl} exists.`);
} catch {
  console.log(`Site ${siteUrl} not found. Check URL!`);
  process.exit(1);
}

console.log(`Ensuring list exists: ${listName}...`);
try {
  execSync(`m365 spo list get --webUrl "${siteUrl}" --title "${listName}"`, { stdio: 'ignore' });
  console.log(`List ${listName} already exists.`);
} catch {
  console.log(`List ${listName} does not exist. Creating it...`);
  execSync(`m365 spo list add --webUrl "${siteUrl}" --baseTemplate GenericList --title "${listName}"`, { stdio: 'inherit' });
}

console.log(`Checking/Provisioning fields for list: ${listName}...`);

/**
 * Fields from spListRegistry.ts:
 * PlanId, Phase, ListKey, FieldName, Action, Risk, AutoExecutable, 
 * RequiresApproval, Reason, Source, ExecutionStatus, ExecutionError, Timestamp
 */
const fields = [
  { name: 'CorrelationId', xml: '<Field Type="Text" DisplayName="Correlation ID" Name="CorrelationId" StaticName="CorrelationId" Indexed="TRUE" />' },
  { name: 'PlanId', xml: '<Field Type="Text" DisplayName="Plan ID" Name="PlanId" StaticName="PlanId" Indexed="TRUE" />' },
  { name: 'Phase', xml: '<Field Type="Text" DisplayName="Phase" Name="Phase" StaticName="Phase" />' },
  { name: 'ListKey', xml: '<Field Type="Text" DisplayName="List Key" Name="ListKey" StaticName="ListKey" Indexed="TRUE" />' },
  { name: 'FieldName', xml: '<Field Type="Text" DisplayName="Field Name" Name="FieldName" StaticName="FieldName" />' },
  { name: 'Action', xml: '<Field Type="Text" DisplayName="Action" Name="Action" StaticName="Action" />' },
  { name: 'Risk', xml: '<Field Type="Text" DisplayName="Risk" Name="Risk" StaticName="Risk" />' },
  { name: 'AutoExecutable', xml: '<Field Type="Boolean" DisplayName="Auto Executable" Name="AutoExecutable" StaticName="AutoExecutable" />' },
  { name: 'RequiresApproval', xml: '<Field Type="Boolean" DisplayName="Requires Approval" Name="RequiresApproval" StaticName="RequiresApproval" />' },
  { name: 'Reason', xml: '<Field Type="Note" DisplayName="Reason" Name="Reason" StaticName="Reason" RichText="FALSE" />' },
  { name: 'Source', xml: '<Field Type="Text" DisplayName="Audit Source" Name="Source" StaticName="Source" />' },
  { name: 'ExecutionStatus', xml: '<Field Type="Text" DisplayName="Execution Status" Name="ExecutionStatus" StaticName="ExecutionStatus" />' },
  { name: 'ExecutionError', xml: '<Field Type="Note" DisplayName="Execution Error" Name="ExecutionError" StaticName="ExecutionError" RichText="FALSE" />' },
  { name: 'Timestamp', xml: '<Field Type="DateTime" DisplayName="Audit Timestamp" Name="Timestamp" StaticName="Timestamp" />' }
];

for (const field of fields) {
  try {
    console.log(`Adding field: ${field.name}...`);
    execSync(`m365 spo field add --webUrl "${siteUrl}" --listTitle "${listName}" --xml '${field.xml}'`, { stdio: 'inherit' });
  } catch {
    console.log(`Field ${field.name} might already exist or error occurred. Skipping...`);
  }
}

console.log('Provisioning completed.');
