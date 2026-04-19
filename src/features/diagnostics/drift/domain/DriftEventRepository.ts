import { DriftEvent } from './driftLogic';

/**
 * DriftEventRepository — ドリフト履歴の永続化インターフェース
 * 
 * SRE 原則「Fail-Open」を遵守し、本インターフェースを使用する全ての層は、
 * 永続化の失敗を業務ロジックの停止原因としてはならない。
 */
export interface IDriftEventRepository {
  /**
   * ドリフトイベントを記録する。
   * 内部で「1日1回」の重複排除を試みるか、呼び出し側で制御する。
   */
  logEvent(event: DriftEvent): Promise<void>;

  /**
   * 指定した条件でイベントをリスト取得する。
   */
  getEvents(filter?: {
    listName?: string;
    resolved?: boolean;
    since?: string;
  }, signal?: AbortSignal): Promise<DriftEvent[]>;

  /**
   * 解決済みマークを付ける。
   */
  markResolved(id: string): Promise<void>;
}
