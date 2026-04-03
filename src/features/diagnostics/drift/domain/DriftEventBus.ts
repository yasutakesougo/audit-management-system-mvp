import { DriftEvent } from './driftLogic';

/**
 * DriftEventBus — ドリフトイベントの通知ハブ
 * 
 * 公開・購読モデルにより、ヘルパー層（helpers.ts）と 
 * 永続化層（Repository）を疎結合に保ちます。
 */
type DriftListener = (event: Omit<DriftEvent, 'id'>) => void;

class DriftEventBus {
  private listeners: DriftListener[] = [];

  /** イベントを発火する */
  emit(event: Omit<DriftEvent, 'id'>) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('DriftEventBus: Error in listener', err);
      }
    });
  }

  /** イベントを購読する */
  subscribe(listener: DriftListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const driftEventBus = new DriftEventBus();
