import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConnectionStatus } from '../useConnectionStatus';
import * as signalStore from '../../spHealthSignalStore';
import * as correlation from '@/lib/telemetry/spProxyCorrelation';

// Mock dependencies
vi.mock('../../spHealthSignalStore', () => ({
  getSpHealthSignal: vi.fn(),
  subscribeSpHealthSignal: vi.fn((_cb) => {
    // Return unsubscribe function
    return () => {};
  }),
  clearSpHealthSignal: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  isDemoModeEnabled: vi.fn(() => false),
  getAppConfig: vi.fn(() => ({
    VITE_SP_RESOURCE: 'test-resource',
    VITE_SP_SITE_URL: 'https://test.sharepoint.com',
  })),
}));

vi.mock('@/lib/telemetry/spProxyCorrelation', () => ({
  recordSpProxyCorrelation: vi.fn(),
}));

describe('useConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records safe health-signal correlation metadata when a signal is observed', () => {
    vi.spyOn(signalStore, 'getSpHealthSignal').mockReturnValue({
      severity: 'critical',
      reasonCode: 'sp_list_unreachable',
      listName: 'Users_Master',
      message: 'List not found',
      occurredAt: '2026-08-04T02:33:00.000Z',
      firstOccurredAt: '2026-08-04T02:30:00.000Z',
      lastOccurredAt: '2026-08-04T02:33:00.000Z',
      source: 'realtime',
      occurrenceCount: 2,
      diagnosticId: 'diag-12345678',
      httpStatus: 404,
      httpStatusClass: '4xx',
      safeErrorCode: 'http_404',
      failureClass: 'http',
      retryClass: 'none',
    });

    renderHook(() => useConnectionStatus());

    expect(correlation.recordSpProxyCorrelation).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosticId: 'diag-12345678',
        event: 'health_signal',
        reasonCode: 'sp_list_unreachable',
        listName: 'Users_Master',
        occurrenceCount: 2,
        status: 404,
        statusClass: '4xx',
        safeErrorCode: 'http_404',
        firstOccurredAt: '2026-08-04T02:30:00.000Z',
        lastOccurredAt: '2026-08-04T02:33:00.000Z',
      }),
    );
  });

  it('returns connected when there is no health signal', () => {
    vi.spyOn(signalStore, 'getSpHealthSignal').mockReturnValue(null);
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.status).toBe('connected');
  });

  it('returns degraded for general health signals', () => {
    vi.spyOn(signalStore, 'getSpHealthSignal').mockReturnValue({
      severity: 'critical',
      reasonCode: 'sp_list_unreachable',
      message: 'List not found',
      occurredAt: new Date().toISOString(),
      source: 'realtime',
      occurrenceCount: 1,
    });
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.status).toBe('degraded');
    expect(result.current.reason).toBe('list_unreachable');
  });

  it('downgrades diagnostics-only failure (DriftEventsLog) to connected', () => {
    vi.spyOn(signalStore, 'getSpHealthSignal').mockReturnValue({
      severity: 'warning',
      reasonCode: 'sp_list_unreachable',
      listName: 'DriftEventsLog_v2',
      message: 'Failed to write log',
      occurredAt: new Date().toISOString(),
      source: 'realtime',
      occurrenceCount: 1,
    });
    const { result } = renderHook(() => useConnectionStatus());
    // Should be connected because it's a diagnostic list
    expect(result.current.status).toBe('connected');
  });

  it('downgrades non-critical schema drift to connected', () => {
    vi.spyOn(signalStore, 'getSpHealthSignal').mockReturnValue({
      severity: 'warning',
      reasonCode: 'sp_schema_drift',
      listName: 'SupportRecord_Daily',
      message: 'Column mismatch',
      occurredAt: new Date().toISOString(),
      source: 'nightly_patrol',
      occurrenceCount: 1,
    });
    const { result } = renderHook(() => useConnectionStatus());
    // Should be connected because drift is warning level
    expect(result.current.status).toBe('connected');
  });

  it('keeps degraded for critical schema drift', () => {
    vi.spyOn(signalStore, 'getSpHealthSignal').mockReturnValue({
      severity: 'critical',
      reasonCode: 'sp_schema_drift',
      listName: 'SupportRecord_Daily',
      message: 'Critical Column missing',
      occurredAt: new Date().toISOString(),
      source: 'nightly_patrol',
      occurrenceCount: 1,
    });
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.status).toBe('degraded');
  });
});
