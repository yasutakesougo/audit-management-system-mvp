/**
 * SharePoint フィールド定義 — Org_Master
 */

export const ORG_MASTER_LIST_TITLE = 'Org_Master' as const;

export const ORG_MASTER_FIELDS = {
  id: 'Id',
  title: 'Title',
  orgCode: 'OrgCode',
  orgType: 'OrgType',
  audience: 'Audience',
  sortOrder: 'SortOrder',
  isActive: 'IsActive',
  notes: 'Notes',
} as const;

export const ORG_MASTER_SELECT_FIELDS = [
  ORG_MASTER_FIELDS.id,
  ORG_MASTER_FIELDS.title,
  ORG_MASTER_FIELDS.orgCode,
  ORG_MASTER_FIELDS.orgType,
  ORG_MASTER_FIELDS.audience,
  ORG_MASTER_FIELDS.sortOrder,
  ORG_MASTER_FIELDS.isActive,
  ORG_MASTER_FIELDS.notes,
] as const;
