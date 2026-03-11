/**
 * OpeningVerificationPage — local types
 */

export interface FieldCheckResult {
  listKey: string;
  listName: string;
  fieldApp: string;
  fieldTenant: string;
  exists: boolean;
  typeMatch: boolean | null;
  tenantType: string | null;
  required: boolean;
  isLookup: boolean;
  status: 'ok' | 'missing' | 'type_mismatch' | 'unmapped_required' | 'lookup_warning';
  expectedJsType?: string;
}

export interface CrudResult {
  entity: string;
  listName: string;
  read: 'ok' | 'fail' | 'skip' | 'pending';
  create: 'ok' | 'fail' | 'skip' | 'pending';
  update: 'ok' | 'fail' | 'skip' | 'pending';
  readError?: string;
  createError?: string;
  updateError?: string;
  readCount?: number;
  createdId?: number;
}

export interface SelectCheckResult {
  listKey: string;
  listName: string;
  selectFields: string;
  fieldCount: number;
  status: 'ok' | 'fail' | 'pending';
  httpStatus?: number;
  error?: string;
  sampleCount?: number;
}
