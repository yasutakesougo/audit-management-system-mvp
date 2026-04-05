import { describe, expect, it, vi } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import {
  MONITORING_MEETING_CANDIDATES,
  type MonitoringMeetingCandidateKey,
} from '@/sharepoint/fields/monitoringMeetingFields';
import { MonitoringMeetingSchemaResolver } from '../MonitoringMeetingSchemaResolver';

const unsupported = (name: string): never => {
  throw new Error(`Unexpected provider call: ${name}`);
};

const defaultListItems: IDataProvider['listItems'] = async () => [];
const defaultGetItemById: IDataProvider['getItemById'] = async () => unsupported('getItemById');
const defaultCreateItem: IDataProvider['createItem'] = async () => unsupported('createItem');
const defaultUpdateItem: IDataProvider['updateItem'] = async () => unsupported('updateItem');
const defaultDeleteItem: IDataProvider['deleteItem'] = async () => unsupported('deleteItem');
const defaultGetMetadata: IDataProvider['getMetadata'] = async () => ({});
const defaultGetFieldInternalNames: IDataProvider['getFieldInternalNames'] = async () => new Set<string>();
const defaultGetResourceNames: IDataProvider['getResourceNames'] = async () => unsupported('getResourceNames');
const defaultEnsureListExists: IDataProvider['ensureListExists'] = async () => {};

const createProvider = (overrides: Partial<IDataProvider> = {}): IDataProvider => ({
  listItems: overrides.listItems ?? defaultListItems,
  getItemById: overrides.getItemById ?? defaultGetItemById,
  createItem: overrides.createItem ?? defaultCreateItem,
  updateItem: overrides.updateItem ?? defaultUpdateItem,
  deleteItem: overrides.deleteItem ?? defaultDeleteItem,
  getMetadata: overrides.getMetadata ?? defaultGetMetadata,
  getFieldInternalNames: overrides.getFieldInternalNames ?? defaultGetFieldInternalNames,
  getResourceNames: overrides.getResourceNames ?? defaultGetResourceNames,
  ensureListExists: overrides.ensureListExists ?? defaultEnsureListExists,
  seed: overrides.seed,
});

describe('MonitoringMeetingSchemaResolver', () => {
  it('resolves schema through list catalog and absorbs alias/_x0020_ drift', async () => {
    const getFieldInternalNames = vi.fn(async (resourceName: string) => {
      if (resourceName !== 'Monitoring_Meetings') throw new Error(`Unexpected list: ${resourceName}`);
      return new Set([
        'Id',
        'Title',
        'RecordId',
        'UserCode',
        'Meeting_x0020_Date',
        'Venue',
      ]);
    }) as IDataProvider['getFieldInternalNames'];

    const provider = createProvider({
      getResourceNames: async () => ['Monitoring_Meetings'],
      getFieldInternalNames,
    });

    const resolver = new MonitoringMeetingSchemaResolver(provider, 'MonitoringMeetings');
    const result = await resolver.resolve();

    expect(result).toBeTruthy();
    expect(result?.listTitle).toBe('Monitoring_Meetings');
    expect(result?.mapping.recordId).toBe('RecordId');
    expect(result?.mapping.userId).toBe('UserCode');
    expect(result?.mapping.meetingDate).toBe('Meeting_x0020_Date');
    expect(result?.mapping.changeReason).toBe('cr014_changeReason');
    expect(result?.select).toContain('Meeting_x0020_Date');
    expect(result?.select).not.toContain('cr014_changeReason');
    expect(getFieldInternalNames).toHaveBeenCalledWith('Monitoring_Meetings');
  });

  it('falls back to direct probes when catalog lookup fails', async () => {
    const getFieldInternalNames = vi.fn(async (resourceName: string) => {
      if (resourceName === 'MonitoringMeetings') {
        return new Set(['cr014_recordId', 'cr014_userId', 'cr014_meetingDate']);
      }
      throw new Error(`Not found: ${resourceName}`);
    }) as IDataProvider['getFieldInternalNames'];

    const provider = createProvider({
      getResourceNames: async () => {
        throw new Error('catalog unavailable');
      },
      getFieldInternalNames,
    });

    const resolver = new MonitoringMeetingSchemaResolver(provider, 'MonitoringMeetings');
    const result = await resolver.resolve();

    expect(result).toBeTruthy();
    expect(result?.listTitle).toBe('MonitoringMeetings');
    expect(result?.mapping.recordId).toBe('cr014_recordId');
    expect(result?.mapping.userId).toBe('cr014_userId');
    expect(result?.mapping.meetingDate).toBe('cr014_meetingDate');
  });

  it('returns null when essential fields are unresolved', async () => {
    const provider = createProvider({
      getResourceNames: async () => ['MonitoringMeetings'],
      getFieldInternalNames: async () => new Set(['cr014_recordId', 'cr014_userId']),
    });

    const resolver = new MonitoringMeetingSchemaResolver(provider, 'MonitoringMeetings');
    await expect(resolver.resolve()).resolves.toBeNull();
  });

  it('fills all unresolved optional fields by primary fallback (no silent drop)', async () => {
    const provider = createProvider({
      getResourceNames: async () => ['MonitoringMeetings'],
      getFieldInternalNames: async () =>
        new Set([
          'Id',
          'Title',
          'RecordId',
          'UserID',
          'MeetingDate',
          'RecordedBy',
        ]),
    });

    const resolver = new MonitoringMeetingSchemaResolver(provider, 'MonitoringMeetings');
    const result = await resolver.resolve();
    expect(result).toBeTruthy();

    const keys = Object.keys(MONITORING_MEETING_CANDIDATES) as MonitoringMeetingCandidateKey[];
    for (const key of keys) {
      expect(result?.mapping[key]).toBeTruthy();
    }
    expect(result?.mapping.recordedBy).toBe('RecordedBy');
    expect(result?.mapping.goalEvaluationsJson).toBe('cr014_goalEvaluationsJson');
  });
});
