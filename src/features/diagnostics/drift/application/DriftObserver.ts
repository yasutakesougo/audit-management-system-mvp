import { driftEventBus } from '../domain/DriftEventBus';
import { IDriftEventRepository } from '../domain/DriftEventRepository';

/**
 * DriftObserver — ドリフトイベントの監視と永続化の橋渡し
 * 
 * アプリケーションの起動時（または管理画面の初期化時）に有効化され、
 * システム全域で発生したドリフトを永続化層へ送ります。
 */
export class DriftObserver {
  private unsubscribe?: () => void;

  constructor(private repository: IDriftEventRepository) {}

  /**
   * 監視を開始する
   */
  start() {
    if (this.unsubscribe) return;

    this.unsubscribe = driftEventBus.subscribe((event) => {
      // 非同期で記録（Fail-Open: 呼び出しを待たせずに実行）
      this.repository.logEvent(event);
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
      console.info('DriftObserver: Stopped monitoring drift events.');
    }
  }
}
