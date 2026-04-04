/**
 * MonitoringMeeting SchemaResolver — GenericSchemaResolver ラッパー
 *
 * 共通基盤 GenericSchemaResolver に MonitoringMeeting 固有の
 * candidates / essentials を注入するだけの薄いラッパー。
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import { GenericSchemaResolver } from '@/lib/sp/GenericSchemaResolver';
import {
  MONITORING_MEETING_CANDIDATES,
  MONITORING_MEETING_ESSENTIALS,
} from '@/sharepoint/fields/monitoringMeetingFields';

export class MonitoringMeetingSchemaResolver {
  private readonly generic: GenericSchemaResolver;

  constructor(spFetch: SpFetchFn, listTitle: string) {
    this.generic = new GenericSchemaResolver(spFetch, {
      listTitle,
      candidates: MONITORING_MEETING_CANDIDATES as unknown as Record<string, string[]>,
      essentials: MONITORING_MEETING_ESSENTIALS as unknown as string[],
      telemetryLabel: 'MonitoringMeetings',
    });
  }

  public resolveListPath(): Promise<string | null> {
    return this.generic.resolveListPath();
  }

  public getResolvedCanonicalNames(): Promise<Record<string, string | undefined>> {
    return this.generic.getResolvedCanonicalNames();
  }
}
