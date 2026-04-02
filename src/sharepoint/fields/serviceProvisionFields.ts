/**
 * SharePoint フィールド定義 — ServiceProvisionRecords
 */

export const SERVICE_PROVISION_LIST_TITLE = 'ServiceProvisionRecords' as const;

export const SERVICE_PROVISION_FIELDS = {
  id: 'Id',
  title: 'Title',
  entryKey: 'EntryKey',
  userCode: 'UserCode',
  recordDate: 'RecordDate',
  status: 'Status',
  startHHMM: 'StartHHMM',
  endHHMM: 'EndHHMM',
  hasTransport: 'HasTransport',
  hasTransportPickup: 'HasTransportPickup',
  hasTransportDropoff: 'HasTransportDropoff',
  hasMeal: 'HasMeal',
  hasBath: 'HasBath',
  hasExtended: 'HasExtended',
  hasAbsentSupport: 'HasAbsentSupport',
  note: 'Note',
  source: 'Source',
  updatedByUPN: 'UpdatedByUPN',
  created: 'Created',
  modified: 'Modified',
} as const;

export const SERVICE_PROVISION_SELECT_FIELDS = [
  SERVICE_PROVISION_FIELDS.id,
  SERVICE_PROVISION_FIELDS.title,
  SERVICE_PROVISION_FIELDS.entryKey,
  SERVICE_PROVISION_FIELDS.userCode,
  SERVICE_PROVISION_FIELDS.recordDate,
  SERVICE_PROVISION_FIELDS.status,
  SERVICE_PROVISION_FIELDS.startHHMM,
  SERVICE_PROVISION_FIELDS.endHHMM,
  SERVICE_PROVISION_FIELDS.hasTransport,
  SERVICE_PROVISION_FIELDS.hasTransportPickup,
  SERVICE_PROVISION_FIELDS.hasTransportDropoff,
  SERVICE_PROVISION_FIELDS.hasMeal,
  SERVICE_PROVISION_FIELDS.hasBath,
  SERVICE_PROVISION_FIELDS.hasExtended,
  SERVICE_PROVISION_FIELDS.hasAbsentSupport,
  SERVICE_PROVISION_FIELDS.note,
  SERVICE_PROVISION_FIELDS.source,
  SERVICE_PROVISION_FIELDS.updatedByUPN,
  SERVICE_PROVISION_FIELDS.created,
  SERVICE_PROVISION_FIELDS.modified,
] as const;
export const SERVICE_PROVISION_CANDIDATES = {
  entryKey: ['EntryKey'],
  userCode: ['UserCode'],
  recordDate: ['RecordDate'],
  status: ['Status'],
  startHHMM: ['StartHHMM'],
  endHHMM: ['EndHHMM'],
  hasTransport: ['HasTransport'],
  hasTransportPickup: ['HasTransportPickup'],
  hasTransportDropoff: ['HasTransportDropoff'],
  hasMeal: ['HasMeal'],
  hasBath: ['HasBath'],
  hasExtended: ['HasExtended'],
  hasAbsentSupport: ['HasAbsentSupport'],
  note: ['Note'],
  source: ['Source'],
  updatedByUPN: ['UpdatedByUPN'],
};
