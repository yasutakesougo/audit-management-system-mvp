import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetSpHealthSignalStore,
  getSpHealthSignal,
  reportSpHealthEvent,
} from '../spHealthSignalStore';

describe('SpHealthSignalStore correlation metadata', () => {
  beforeEach(() => {
    _resetSpHealthSignalStore();
  });

  afterEach(() => {
    _resetSpHealthSignalStore();
  });

  it('retains first and latest occurrence times while updating the diagnostic ID', () => {
    const firstOccurredAt = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const lastOccurredAt = new Date().toISOString();

    reportSpHealthEvent({
      severity: 'critical',
      reasonCode: 'sp_list_unreachable',
      listName: 'Users_Master',
      message: 'List not found',
      occurredAt: firstOccurredAt,
      source: 'realtime',
      diagnosticId: 'diag-12345678',
      httpStatus: 404,
      httpStatusClass: '4xx',
      safeErrorCode: 'http_404',
      failureClass: 'http',
      retryClass: 'none',
    });
    reportSpHealthEvent({
      severity: 'critical',
      reasonCode: 'sp_list_unreachable',
      listName: 'Users_Master',
      message: 'List not found',
      occurredAt: lastOccurredAt,
      source: 'realtime',
      diagnosticId: 'diag-87654321',
      httpStatus: 404,
      httpStatusClass: '4xx',
      safeErrorCode: 'http_404',
      failureClass: 'http',
      retryClass: 'none',
    });

    expect(getSpHealthSignal()).toMatchObject({
      occurrenceCount: 2,
      diagnosticId: 'diag-87654321',
      firstOccurredAt,
      lastOccurredAt,
    });
  });
});
