import { DriftActionEvent, DriftEventHandler } from './driftEvents';
import { auditLog } from '@/lib/debugLogger';

/**
 * 簡易的なインメモリ・イベントバス。
 * スキーマのリフレッシュや、UIコンポーネントでの即時表示に使用。
 */
class DriftEventBus {
  private handlers: DriftEventHandler[] = [];

  subscribe(handler: DriftEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  emit(event: DriftActionEvent): void {
    this.handlers.forEach(h => {
      try {
        h(event);
      } catch (e) {
        auditLog.error('sp', 'drift_event_handler_error', e);
      }
    });
  }
}

export const globalDriftEventBus = new DriftEventBus();

/**
 * 標準のドリフトイベントハンドラ。
 * ログ出力に加え、グローバルなイベントバスへ転送する。
 */
export const defaultDriftEventHandler: DriftEventHandler = (event) => {
  // 1. AuditLog への構造化ログ (既に Resolver 内で一部行っているが、ここでは統一形式で)
  auditLog.info('sp', `drift_action:${event.kind}`, event);

  // 2. イベントバスに流す (UI や KPI 集計用)
  globalDriftEventBus.emit(event);

  // 3. 今後はここに「重要度が高い場合の即時通知」などを追加可能
};
