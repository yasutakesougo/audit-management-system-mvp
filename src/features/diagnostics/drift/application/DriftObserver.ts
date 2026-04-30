import { driftEventBus } from '../domain/DriftEventBus';
import { IDriftEventRepository } from '../domain/DriftEventRepository';

/**
 * DriftObserver — ドリフトイベントの監視と永続化の橋渡し
 * 
 * アプリケーションの起動時（または管理画面の初期化時）に有効化され、
 * システム全域で発生したドリフトを永続化層へ送ります。
 */
export class DriftObserver {
  private static instanceCount = 0;
  private unsubscribe?: () => void;

  constructor(private repository: IDriftEventRepository) {}

  /**
   * 監視を開始する
   */
  start() {
    if (this.unsubscribe) return;

    DriftObserver.instanceCount++;
    if (DriftObserver.instanceCount > 1) {
      console.warn(`DriftObserver: Multiple instances detected (${DriftObserver.instanceCount}). Only the first one should be active.`);
    }

    this.unsubscribe = driftEventBus.subscribe((event) => {
      // 非同期で記録（Fail-Open: 呼び出しを待たせずに実行）
      void this.repository.logEvent(event).catch((err) => {
        console.warn('DriftObserver: drift logging skipped due to repository failure.', err);
      });
    });
    
    console.info('DriftObserver: Started monitoring drift events.');
  }

  /**
   * 監視を停止する
   */
  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
      DriftObserver.instanceCount = Math.max(0, DriftObserver.instanceCount - 1);
      console.info('DriftObserver: Stopped monitoring drift events.');
    }
  }
}
