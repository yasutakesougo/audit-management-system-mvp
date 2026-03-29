/**
 * spMonitoringMeetingRepository.ts — compat stub
 *
 * The original SharePoint-direct monitoring meeting repository was removed in the
 * data-os refactor. Functionality is now in DataProviderMonitoringMeetingRepository.
 * This stub is retained so existing test files continue to type-check.
 *
 * @deprecated Use DataProviderMonitoringMeetingRepository via useMonitoringMeetingRepository hook.
 */

import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { SpMonitoringMeetingRow } from '@/sharepoint/fields/monitoringMeetingFields';

/** @deprecated */
export const mapSpRowToMonitoringMeeting = (_row: SpMonitoringMeetingRow): MonitoringMeetingRecord => {
  throw new Error('mapSpRowToMonitoringMeeting: stub — use DataProviderMonitoringMeetingRepository');
};

/** @deprecated */
export const buildMonitoringMeetingBody = (_record: MonitoringMeetingRecord): Record<string, unknown> => {
  throw new Error('buildMonitoringMeetingBody: stub — use DataProviderMonitoringMeetingRepository');
};

/** @deprecated */
export const createSpMonitoringMeetingRepository = (_spClient: unknown): MonitoringMeetingRepository => {
  throw new Error('createSpMonitoringMeetingRepository: stub — use DataProviderMonitoringMeetingRepository');
};
