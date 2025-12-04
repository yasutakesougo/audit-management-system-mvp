import { z } from 'zod';

import {
    ORG_MASTER_FIELDS,
    ORG_MASTER_LIST_TITLE,
    ORG_MASTER_SELECT_FIELDS,
} from '@/sharepoint/fields';

export { ORG_MASTER_FIELDS, ORG_MASTER_LIST_TITLE, ORG_MASTER_SELECT_FIELDS };

export type OrgMasterRecord = {
  id: number;
  label: string;
  orgCode: string;
  orgType?: string;
  audience: string[];
  sortOrder: number;
  isActive: boolean;
  notes?: string;
};

const audienceSplitter = /[\r\n,、，]+/;

const trimString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeAudience = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const flattened = rawValues
    .filter((entry): entry is string => typeof entry === 'string')
    .flatMap((entry) => entry.split(audienceSplitter))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(flattened));
};

const resolveSortOrder = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 9999;
};

const resolveIsActive = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  return true;
};

const rawOrgRowSchema = z.object({
    [ORG_MASTER_FIELDS.id]: z.coerce.number().int().positive().optional(),
    ID: z.coerce.number().int().positive().optional(),
    [ORG_MASTER_FIELDS.title]: z.string().optional().nullable(),
    [ORG_MASTER_FIELDS.orgCode]: z.string().optional().nullable(),
    [ORG_MASTER_FIELDS.orgType]: z.string().optional().nullable(),
    [ORG_MASTER_FIELDS.audience]: z.union([z.string(), z.array(z.string())]).optional().nullable(),
    [ORG_MASTER_FIELDS.sortOrder]: z.number().optional().nullable(),
    [ORG_MASTER_FIELDS.isActive]: z.boolean().optional().nullable(),
    [ORG_MASTER_FIELDS.notes]: z.string().optional().nullable(),
  });

export const SpOrgRowSchema = rawOrgRowSchema.transform((row): OrgMasterRecord => {
    const id = row[ORG_MASTER_FIELDS.id] ?? row.ID;
    if (!id) {
      throw new Error('Org_Master row missing Id/ID');
    }

    const orgCode = trimString(row[ORG_MASTER_FIELDS.orgCode]) ?? '';
    const fallbackLabel = orgCode || String(id);
    const label = trimString(row[ORG_MASTER_FIELDS.title]) ?? fallbackLabel;
    const orgType = trimString(row[ORG_MASTER_FIELDS.orgType]);
    const audience = normalizeAudience(row[ORG_MASTER_FIELDS.audience]);
    const sortOrder = resolveSortOrder(row[ORG_MASTER_FIELDS.sortOrder]);
    const isActive = resolveIsActive(row[ORG_MASTER_FIELDS.isActive]);
    const notes = trimString(row[ORG_MASTER_FIELDS.notes]);

    return {
      id,
      label,
      orgCode,
      orgType,
      audience,
      sortOrder,
      isActive,
      notes,
    };
  });

export const parseOrgMasterRows = (input: unknown): OrgMasterRecord[] =>
  SpOrgRowSchema.array().parse(input);
