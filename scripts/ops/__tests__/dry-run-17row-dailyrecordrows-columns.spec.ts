import { describe, expect, it } from 'vitest';
import { build17RowColumnsDryRunReport } from '../dry-run-17row-dailyrecordrows-columns';

describe('build17RowColumnsDryRunReport', () => {
  it('marks guarded apply ready when no exact conflicts and SourceFileName0 exists', () => {
    const report = build17RowColumnsDryRunReport(
      [
        { internalName: 'ParentID', candidates: ['ParentID'] },
        { internalName: 'UserID', candidates: ['UserID'] },
      ],
      [
        { internalName: 'UserCode0', type: 'Text', displayName: 'User Code', candidates: ['UserCode0', 'UserCode'] },
        { internalName: 'SourceFileName0', type: 'Text', displayName: 'Source File Name', required: true, candidates: ['SourceFileName0'] },
      ]
    );

    expect(report.conflicts).toEqual([]);
    expect(report.requiredAuditFieldPresent).toBe(true);
    expect(report.guardedApplyReady).toBe(true);
  });

  it('reports conflict when proposed internal name already exists', () => {
    const report = build17RowColumnsDryRunReport(
      [{ internalName: 'RowNo0', candidates: ['RowNo0'] }],
      [
        { internalName: 'RowNo0', type: 'Number', displayName: 'Row No', candidates: ['RowNo0', 'RowNo'] },
        { internalName: 'SourceFileName0', type: 'Text', displayName: 'Source File Name', required: true, candidates: ['SourceFileName0'] },
      ]
    );

    expect(report.conflicts).toEqual(['RowNo0']);
    expect(report.guardedApplyReady).toBe(false);
  });

  it('detects drift risk via alias overlap', () => {
    const report = build17RowColumnsDryRunReport(
      [{ internalName: 'UserID', candidates: ['User_x0020_ID', 'UserCode'] }],
      [
        { internalName: 'UserCode0', type: 'Text', displayName: 'User Code', candidates: ['UserCode0', 'UserCode'] },
        { internalName: 'SourceFileName0', type: 'Text', displayName: 'Source File Name', required: true, candidates: ['SourceFileName0'] },
      ]
    );

    expect(report.internalNameDriftRisks).toEqual([
      { internalName: 'UserCode0', matchedAliases: ['UserCode'] },
    ]);
  });
});
