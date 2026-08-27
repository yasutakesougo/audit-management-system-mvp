import { describe, expect, it } from 'vitest';
import { ParentStorageUniquenessConflictError } from '../../../domain/persistence/dailyRecordPersistence';
import {
  classifyDailyRecordParentHttpFailure,
  classifyDailyRecordParentHttpFailureFromError,
  throwDailyRecordParentHttpFailure,
} from './dailyRecordSpHttpErrors';

describe('dailyRecordSpHttpErrors', () => {
  it('classifies parent create storage conflicts (409/400 duplicate)', () => {
    expect(classifyDailyRecordParentHttpFailure(409, null, 'parent_create'))
      .toBe('storage_uniqueness_conflict');
    expect(classifyDailyRecordParentHttpFailure(400, 'duplicate value found for Title', 'parent_create'))
      .toBe('storage_uniqueness_conflict');
    expect(classifyDailyRecordParentHttpFailure(400, 'Field not found', 'parent_create'))
      .toBe('http_error');
  });

  it('classifies parent commit ETag conflicts (412/428/409/400 precondition)', () => {
    expect(classifyDailyRecordParentHttpFailure(412, null, 'parent_commit'))
      .toBe('commit_etag_conflict');
    expect(classifyDailyRecordParentHttpFailure(428, null, 'parent_commit'))
      .toBe('commit_etag_conflict');
    expect(classifyDailyRecordParentHttpFailure(409, null, 'parent_commit'))
      .toBe('commit_etag_conflict');
    expect(classifyDailyRecordParentHttpFailure(400, 'Precondition Failed', 'parent_commit'))
      .toBe('commit_etag_conflict');
  });

  it('classifies thrown spFetch errors by status property', () => {
    expect(classifyDailyRecordParentHttpFailureFromError({ status: 412, message: 'Precondition Failed' }, 'parent_commit'))
      .toBe('commit_etag_conflict');
    expect(classifyDailyRecordParentHttpFailureFromError({ status: 409, message: 'duplicate value' }, 'parent_create'))
      .toBe('storage_uniqueness_conflict');
  });

  it('throws typed storage conflict for parent create 409', () => {
    expect(() => throwDailyRecordParentHttpFailure('parent_create', 409, null, { date: '2026-08-27' }))
      .toThrow(ParentStorageUniquenessConflictError);
  });

  it('throws ETag conflict message for parent commit 412', () => {
    expect(() => throwDailyRecordParentHttpFailure('parent_commit', 412, null, { commitId: 'commit-B' }))
      .toThrow(/ETag conflict \(HTTP 412\)/);
  });
});
