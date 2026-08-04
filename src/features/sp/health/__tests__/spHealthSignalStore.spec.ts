import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetSpHealthSignalStore,
  getSpHealthSignal,
  reportSpHealthEvent,
} from '../spHealthSignalStore';

describe('SpHealthSignalStore correlation metadata', () => {
  afterEach(() => {
    _resetSpHealthSignalStore();
  });

  it('retains first and latest occurrence times while updating the diagnostic ID', () => {
    reportSpHealthEvent({
      severity: 'critical',
      reasonCode: 'sp_list_unreachable',
      listName: 'Users_Master',
      message: 'List not found',
      occurredAt: '2026-08-04T02:30:00.000Z',
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
      occurredAt: '2026-08-04T02:33:00.000Z',
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
      firstOccurredAt: '2026-08-04T02:30:00.000Z',
      lastOccurredAt: '2026-08-04T02:33:00.000Z',
    });
  });
});
