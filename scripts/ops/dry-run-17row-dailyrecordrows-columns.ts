import { dailyListEntries, DAILY_RECORD_ROWS_17ROW_PROPOSED_FIELDS } from '../../src/sharepoint/spListRegistry.definitions';

type ProvisioningField = {
  internalName: string;
  candidates?: readonly string[];
};

type ProposedField = (typeof DAILY_RECORD_ROWS_17ROW_PROPOSED_FIELDS)[number];

export type DryRunReport = {
  proposedFields: string[];
  conflicts: string[];
  internalNameDriftRisks: Array<{ internalName: string; matchedAliases: string[] }>;
  requiredAuditFieldPresent: boolean;
  guardedApplyReady: boolean;
};

const SUPPORT_RECORD_ROWS_KEY = 'support_record_rows';

const getExistingRowsFields = (): ProvisioningField[] => {
  const entry = dailyListEntries.find((item) => item.key === SUPPORT_RECORD_ROWS_KEY);
  if (!entry?.provisioningFields) {
    throw new Error(`Registry entry not found or has no provisioningFields: ${SUPPORT_RECORD_ROWS_KEY}`);
  }
  return entry.provisioningFields as ProvisioningField[];
};

export const build17RowColumnsDryRunReport = (
  existingFields = getExistingRowsFields(),
  proposedFields: readonly ProposedField[] = DAILY_RECORD_ROWS_17ROW_PROPOSED_FIELDS
): DryRunReport => {
  const existingInternalNames = new Set(existingFields.map((field) => field.internalName));
  const existingAliasUniverse = new Set<string>();
  for (const field of existingFields) {
    existingAliasUniverse.add(field.internalName);
    for (const alias of field.candidates ?? []) {
      existingAliasUniverse.add(alias);
    }
  }

  const proposedInternalNames = proposedFields.map((field) => field.internalName);
  const conflicts = proposedInternalNames.filter((name) => existingInternalNames.has(name));
  const internalNameDriftRisks: Array<{ internalName: string; matchedAliases: string[] }> = [];

  for (const field of proposedFields) {
    const aliases = (field.candidates ?? []).filter((alias) => alias !== field.internalName);
    const matchedAliases = aliases.filter((alias) => existingAliasUniverse.has(alias));
    if (matchedAliases.length > 0) {
      internalNameDriftRisks.push({
        internalName: field.internalName,
        matchedAliases,
      });
    }
  }

  const requiredAuditFieldPresent = proposedInternalNames.includes('SourceFileName0');
  const guardedApplyReady = requiredAuditFieldPresent && conflicts.length === 0;

  return {
    proposedFields: proposedInternalNames,
    conflicts,
    internalNameDriftRisks,
    requiredAuditFieldPresent,
    guardedApplyReady,
  };
};

const printReport = (report: DryRunReport): void => {
  console.log('=== DailyRecordRows 17-row columns dry-run ===');
  console.log('');
  console.log('[追加予定列]');
  for (const field of report.proposedFields) {
    console.log(`- ${field}`);
  }

  console.log('');
  console.log('[既存列と衝突する列]');
  if (report.conflicts.length === 0) {
    console.log('- (none)');
  } else {
    for (const field of report.conflicts) {
      console.log(`- ${field}`);
    }
  }

  console.log('');
  console.log('[internal name drift の可能性がある列]');
  if (report.internalNameDriftRisks.length === 0) {
    console.log('- (none)');
  } else {
    for (const risk of report.internalNameDriftRisks) {
      console.log(`- ${risk.internalName}: aliases in use -> ${risk.matchedAliases.join(', ')}`);
    }
  }

  console.log('');
  console.log('[guarded apply 判定]');
  console.log(`- SourceFileName0 present: ${report.requiredAuditFieldPresent ? 'yes' : 'no'}`);
  console.log(`- guarded apply ready: ${report.guardedApplyReady ? 'yes' : 'no'}`);
};

const main = (): void => {
  const report = build17RowColumnsDryRunReport();
  printReport(report);
  process.exit(report.guardedApplyReady ? 0 : 1);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
