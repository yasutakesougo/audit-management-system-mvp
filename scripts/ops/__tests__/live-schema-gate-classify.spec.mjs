// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  LIVE_SCHEMA_GATE_CHECKS,
  classifyLiveSchemaInventory,
  normalizeInventoryField,
  summarizeLiveSchemaGate,
  typeMatches,
} from '../live-schema-gate/classify.mjs';

const parentFields = (extra = []) => [
  { InternalName: 'Title', Title: 'Title', TypeAsString: 'Text', Indexed: true, EnforceUniqueValues: true },
  { InternalName: 'RecordDate', TypeAsString: 'DateTime', Indexed: true, EnforceUniqueValues: false },
  ...extra,
];

const rowFields = (extra = []) => [
  { InternalName: 'ParentID', TypeAsString: 'Number', Indexed: true, EnforceUniqueValues: false },
  ...extra,
];

describe('LIVE-SCHEMA-GATE-V1 classify', () => {
  it('defines exactly the four live checks', () => {
    expect(LIVE_SCHEMA_GATE_CHECKS.map((check) => check.id)).toEqual([
      'SupportRecord_Daily.LatestVersion',
      'SupportRecord_Daily.LatestCommitId',
      'DailyRecordRows.CommitId',
      'SupportRecord_Daily.Title.indexedUnique',
    ]);
  });

  it('keeps all four UNVERIFIED when lists were not read (do not infer MISSING)', () => {
    const checks = classifyLiveSchemaInventory({ lists: {} });
    expect(checks.every((check) => check.status === 'UNVERIFIED')).toBe(true);
    expect(summarizeLiveSchemaGate(checks).gate).toBe('HOLD');
    expect(summarizeLiveSchemaGate(checks).mutation).toBe('NONE');
  });

  it('does not treat an unread list as MISSING', () => {
    const checks = classifyLiveSchemaInventory({
      lists: {
        SupportRecord_Daily: { found: null, fields: null, error: 'connector blocked' },
      },
    });
    const latestVersion = checks.find((check) => check.id === 'SupportRecord_Daily.LatestVersion');
    expect(latestVersion.status).toBe('UNVERIFIED');
    expect(latestVersion.status).not.toBe('MISSING');
  });

  it('records LIST_MISSING when the list 404s', () => {
    const checks = classifyLiveSchemaInventory({
      lists: {
        SupportRecord_Daily: { found: false, fields: [], error: 'HTTP 404' },
        DailyRecordRows: { found: false, fields: [], error: 'HTTP 404' },
      },
    });
    expect(checks.every((check) => check.status === 'LIST_MISSING')).toBe(true);
    expect(summarizeLiveSchemaGate(checks).gate).toBe('VERIFIED_GAPS');
  });

  it('records MISSING when the list exists but the candidate is absent', () => {
    const checks = classifyLiveSchemaInventory({
      lists: {
        SupportRecord_Daily: { found: true, uniqueConstraintReadable: true, fields: parentFields() },
        DailyRecordRows: { found: true, uniqueConstraintReadable: true, fields: rowFields() },
      },
    });
    expect(checks.find((check) => check.id === 'SupportRecord_Daily.LatestVersion').status).toBe('MISSING');
    expect(checks.find((check) => check.id === 'SupportRecord_Daily.LatestCommitId').status).toBe('MISSING');
    expect(checks.find((check) => check.id === 'DailyRecordRows.CommitId').status).toBe('MISSING');
    expect(checks.find((check) => check.id === 'SupportRecord_Daily.Title.indexedUnique').status).toBe('PRESENT_MATCH');
    expect(summarizeLiveSchemaGate(checks).gate).toBe('VERIFIED_GAPS');
  });

  it('accepts drift candidate names from dailyFields.ts', () => {
    const checks = classifyLiveSchemaInventory({
      lists: {
        SupportRecord_Daily: {
          found: true,
          uniqueConstraintReadable: true,
          fields: parentFields([
            { InternalName: 'cr013_latestVersion', TypeAsString: 'Number', Indexed: false, EnforceUniqueValues: false },
            { InternalName: 'cr013_latestCommitId', TypeAsString: 'Text', Indexed: false, EnforceUniqueValues: false },
          ]),
        },
        DailyRecordRows: {
          found: true,
          uniqueConstraintReadable: true,
          fields: rowFields([
            { InternalName: 'cr013_commitId', TypeAsString: 'Text', Indexed: false, EnforceUniqueValues: false },
          ]),
        },
      },
    });
    expect(checks.every((check) => check.status === 'PRESENT_MATCH')).toBe(true);
    expect(summarizeLiveSchemaGate(checks).gate).toBe('VERIFIED_MATCH');
  });

  it('flags Title when Indexed or EnforceUniqueValues is false', () => {
    const checks = classifyLiveSchemaInventory({
      lists: {
        SupportRecord_Daily: {
          found: true,
          uniqueConstraintReadable: true,
          fields: [
            { InternalName: 'Title', TypeAsString: 'Text', Indexed: false, EnforceUniqueValues: false },
            { InternalName: 'LatestVersion', TypeAsString: 'Number' },
            { InternalName: 'LatestCommitId', TypeAsString: 'Text' },
          ],
        },
        DailyRecordRows: {
          found: true,
          uniqueConstraintReadable: true,
          fields: [{ InternalName: 'CommitId', TypeAsString: 'Text' }],
        },
      },
    });
    const title = checks.find((check) => check.id === 'SupportRecord_Daily.Title.indexedUnique');
    expect(title.status).toBe('PRESENT_MISMATCH');
    expect(title.mismatches).toEqual(expect.arrayContaining(['Indexed=false', 'EnforceUniqueValues=false']));
    expect(summarizeLiveSchemaGate(checks).gate).toBe('VERIFIED_GAPS');
  });

  it('keeps Title unique UNVERIFIED on Graph dumps that omit EnforceUniqueValues', () => {
    const graphTitle = normalizeInventoryField({
      name: 'Title',
      displayName: 'Title',
      indexed: true,
      text: { allowMultipleLines: false },
    });
    expect(graphTitle.TypeAsString).toBe('Text');
    expect(graphTitle.Indexed).toBe(true);
    expect(graphTitle.EnforceUniqueValues).toBeNull();

    const checks = classifyLiveSchemaInventory({
      uniqueConstraintReadable: false,
      lists: {
        SupportRecord_Daily: {
          found: true,
          uniqueConstraintReadable: false,
          fields: [
            graphTitle,
            normalizeInventoryField({ name: 'LatestVersion', number: {} }),
            normalizeInventoryField({ name: 'LatestCommitId', text: {} }),
          ],
        },
        DailyRecordRows: {
          found: true,
          uniqueConstraintReadable: false,
          fields: [normalizeInventoryField({ name: 'CommitId', text: {} })],
        },
      },
    });
    expect(checks.find((check) => check.id === 'SupportRecord_Daily.LatestVersion').status).toBe('PRESENT_MATCH');
    expect(checks.find((check) => check.id === 'SupportRecord_Daily.Title.indexedUnique').status).toBe('UNVERIFIED');
    expect(summarizeLiveSchemaGate(checks).gate).toBe('HOLD');
  });

  it('treats wrong types as PRESENT_MISMATCH, not UNVERIFIED', () => {
    expect(typeMatches('Note', ['Text'])).toBe(false);
    const checks = classifyLiveSchemaInventory({
      lists: {
        SupportRecord_Daily: {
          found: true,
          uniqueConstraintReadable: true,
          fields: parentFields([
            { InternalName: 'LatestVersion', TypeAsString: 'Text' },
            { InternalName: 'LatestCommitId', TypeAsString: 'Note' },
          ]),
        },
        DailyRecordRows: {
          found: true,
          uniqueConstraintReadable: true,
          fields: rowFields([{ InternalName: 'CommitId', TypeAsString: 'Number' }]),
        },
      },
    });
    expect(checks.find((check) => check.id === 'SupportRecord_Daily.LatestVersion').status).toBe('PRESENT_MISMATCH');
    expect(checks.find((check) => check.id === 'SupportRecord_Daily.LatestCommitId').status).toBe('PRESENT_MISMATCH');
    expect(checks.find((check) => check.id === 'DailyRecordRows.CommitId').status).toBe('PRESENT_MISMATCH');
  });
});

const INVENTORY = path.join(process.cwd(), 'scripts', 'ops', 'live-schema-gate-inventory.mjs');

describe('live-schema-gate-inventory CLI', () => {
  it('--mode hold writes UNVERIFIED evidence and exits 2 without calling SharePoint', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'live-schema-gate-'));
    const out = path.join(dir, 'HOLD.json');
    const result = spawnSync(process.execPath, [INVENTORY, '--mode', 'hold', '--out', out], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(2);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    expect(report.gate).toBe('HOLD');
    expect(report.mutation).toBe(false);
    expect(report.schemaMutation).toBe('NONE');
    expect(report.deploy).toBe('NOT_AUTHORIZED');
    expect(report.httpMethods).toEqual([]);
    expect(report.checks.every((check) => check.status === 'UNVERIFIED')).toBe(true);
  });

  it('--mode file classifies a captured REST dump without mutation', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'live-schema-gate-'));
    const input = path.join(dir, 'dump.json');
    const out = path.join(dir, 'classified.json');
    writeFileSync(input, JSON.stringify({
      lists: {
        SupportRecord_Daily: {
          found: true,
          uniqueConstraintReadable: true,
          fields: [
            { InternalName: 'Title', TypeAsString: 'Text', Indexed: true, EnforceUniqueValues: true },
            { InternalName: 'LatestVersion', TypeAsString: 'Number' },
            { InternalName: 'LatestCommitId', TypeAsString: 'Text' },
          ],
        },
        DailyRecordRows: {
          found: true,
          uniqueConstraintReadable: true,
          fields: [{ InternalName: 'CommitId', TypeAsString: 'Text' }],
        },
      },
    }));
    const result = spawnSync(process.execPath, [INVENTORY, '--mode', 'file', '--input', input, '--out', out], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    expect(report.gate).toBe('VERIFIED_MATCH');
    expect(report.mutation).toBe(false);
  });
});
