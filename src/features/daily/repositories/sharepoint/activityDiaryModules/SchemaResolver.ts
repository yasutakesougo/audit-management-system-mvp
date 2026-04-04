/**
 * ActivityDiary SchemaResolver — GenericSchemaResolver ラッパー
 *
 * 共通基盤 GenericSchemaResolver に ActivityDiary 固有の
 * candidates / essentials を注入するだけの薄いラッパー。
 *
 * 既存の呼び出し元インターフェースを維持しつつ、
 * ロジックは完全に共通基盤に委譲する。
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import { GenericSchemaResolver } from '@/lib/sp/GenericSchemaResolver';
import {
  ACTIVITY_DIARY_CANDIDATES,
  ACTIVITY_DIARY_ESSENTIALS,
} from '@/sharepoint/fields/activityDiaryFields';

export class ActivityDiarySchemaResolver {
  private readonly generic: GenericSchemaResolver;

  constructor(spFetch: SpFetchFn, listTitle: string) {
    this.generic = new GenericSchemaResolver(spFetch, {
      listTitle,
      candidates: ACTIVITY_DIARY_CANDIDATES as unknown as Record<string, string[]>,
      essentials: ACTIVITY_DIARY_ESSENTIALS as unknown as string[],
      telemetryLabel: 'ActivityDiary',
    });
  }

  public resolveListPath(): Promise<string | null> {
    return this.generic.resolveListPath();
  }

  public getResolvedCanonicalNames(): Promise<Record<string, string | undefined>> {
    return this.generic.getResolvedCanonicalNames();
  }
}
