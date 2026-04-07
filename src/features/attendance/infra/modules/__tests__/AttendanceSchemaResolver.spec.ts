import { describe, expect, it, vi } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import {
  ATTENDANCE_DAILY_CANDIDATES,
  ATTENDANCE_DAILY_ESSENTIALS,
  type AttendanceDailyCandidateKey,
} from '@/sharepoint/fields/attendanceFields';
import { AttendanceSchemaResolver } from '../AttendanceSchemaResolver';

const unsupported = (name: string): never => {
  throw new Error(`Unexpected provider call: ${name}`);
};

const defaultListItems: IDataProvider['listItems'] = async () => [];
const defaultGetItemById: IDataProvider['getItemById'] = async () => unsupported('getItemById');
const defaultCreateItem: IDataProvider['createItem'] = async () => unsupported('createItem');
const defaultUpdateItem: IDataProvider['updateItem'] = async () => unsupported('updateItem');
const defaultDeleteItem: IDataProvider['deleteItem'] = async () => unsupported('deleteItem');
const defaultGetMetadata: IDataProvider['getMetadata'] = async () => ({});
const defaultGetResourceNames: IDataProvider['getResourceNames'] = async () => [];
const defaultGetFieldInternalNames: IDataProvider['getFieldInternalNames'] = async () =>
  new Set<string>();
const defaultEnsureListExists: IDataProvider['ensureListExists'] = async () => {};

const createProvider = (overrides: Partial<IDataProvider> = {}): IDataProvider => ({
  listItems: overrides.listItems ?? defaultListItems,
  getItemById: overrides.getItemById ?? defaultGetItemById,
  createItem: overrides.createItem ?? defaultCreateItem,
  updateItem: overrides.updateItem ?? defaultUpdateItem,
  deleteItem: overrides.deleteItem ?? defaultDeleteItem,
  getMetadata: overrides.getMetadata ?? defaultGetMetadata,
  getResourceNames: overrides.getResourceNames ?? defaultGetResourceNames,
  getFieldInternalNames: overrides.getFieldInternalNames ?? defaultGetFieldInternalNames,
  ensureListExists: overrides.ensureListExists ?? defaultEnsureListExists,
  seed: overrides.seed,
});

const createResolver = (provider: IDataProvider, listTitle = 'Daily_Attendance') =>
  new AttendanceSchemaResolver<AttendanceDailyCandidateKey>({
    provider,
    listTitle,
    listTitleFallbacks: ['AttendanceDaily', 'SupportRecord_Daily'],
    candidates: ATTENDANCE_DAILY_CANDIDATES,
    essentials: ATTENDANCE_DAILY_ESSENTIALS,
    logCategory: 'attendance:repo',
    schemaName: 'AttendanceDaily',
  });

describe('AttendanceSchemaResolver', () => {
  if (typeof sessionStorage !== 'undefined') {
    beforeEach(() => {
      sessionStorage.clear();
    });
  }
  it('resolves by list catalog and absorbs alias/suffix drift', async () => {
    const getFieldInternalNames = vi.fn(async (resourceName: string) => {
      if (resourceName !== 'Daily_Attendance') throw new Error(`Unexpected list: ${resourceName}`);
      return new Set([
        'Id',
        'Title',
        'User_x0020_Id',
        'AttendanceDate0',
        'Status0',
        'CheckInTime',
      ]);
    }) as IDataProvider['getFieldInternalNames'];

    const provider = createProvider({
      getResourceNames: async () => ['Daily_Attendance'],
      getFieldInternalNames,
    });

    const resolver = createResolver(provider);
    const result = await resolver.resolve();

    expect(result).toBeTruthy();
    expect(result?.listTitle).toBe('Daily_Attendance');
    expect(result?.mapping.userCode).toBe('User_x0020_Id');
    expect(result?.mapping.recordDate).toBe('AttendanceDate0');
    expect(result?.mapping.status).toBe('Status0');
    expect(result?.missing).toContain('staffInChargeId');
    expect(result?.select).toContain('AttendanceDate0');
    expect(getFieldInternalNames).toHaveBeenCalledWith('Daily_Attendance');
  });

  it('falls back to direct probes when catalog lookup fails', async () => {
    const getFieldInternalNames = vi.fn(async (resourceName: string) => {
      if (resourceName === 'SupportRecord_Daily') {
        return new Set([
          'cr013_userCode',
          'cr013_recordDate',
          'cr013_status',
          'cr013_checkInAt',
        ]);
      }
      throw new Error(`Not found: ${resourceName}`);
    }) as IDataProvider['getFieldInternalNames'];

    const provider = createProvider({
      getResourceNames: async () => {
        throw new Error('catalog unavailable');
      },
      getFieldInternalNames,
    });

    const resolver = createResolver(provider, 'SupportRecord_Daily');
    const result = await resolver.resolve();

    expect(result).toBeTruthy();
    expect(result?.listTitle).toBe('SupportRecord_Daily');
    expect(result?.mapping.userCode).toBe('cr013_userCode');
    expect(result?.mapping.recordDate).toBe('cr013_recordDate');
    expect(result?.mapping.status).toBe('cr013_status');
  });

  it('returns null when essential fields are unresolved', async () => {
    const provider = createProvider({
      getResourceNames: async () => ['Daily_Attendance'],
      getFieldInternalNames: async () => new Set(['UserCode', 'RecordDate']),
    });

    const resolver = createResolver(provider);
    await expect(resolver.resolve()).resolves.toBeNull();
  });

  it('keeps unresolved optionals as missing while mapping falls back to primary names', async () => {
    const provider = createProvider({
      getResourceNames: async () => ['Daily_Attendance'],
      getFieldInternalNames: async () =>
        new Set([
          'Id',
          'Title',
          'UserCode',
          'RecordDate',
          'Status',
          'CheckInAt',
        ]),
    });

    const resolver = createResolver(provider);
    const result = await resolver.resolve();
    expect(result).toBeTruthy();

    const keys = Object.keys(ATTENDANCE_DAILY_CANDIDATES) as AttendanceDailyCandidateKey[];
    for (const key of keys) {
      expect(result?.mapping[key]).toBeTruthy();
    }

    expect(result?.missing).toContain('staffInChargeId');
    expect(result?.mapping.staffInChargeId).toBe(ATTENDANCE_DAILY_CANDIDATES.staffInChargeId[0]);
    expect(result?.select).not.toContain(ATTENDANCE_DAILY_CANDIDATES.staffInChargeId[0]);
  });
});
