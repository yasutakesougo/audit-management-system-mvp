import { DriftActionEvent } from './driftEvents';
import { globalDriftEventBus } from './onDriftEvent';

/**
 * スケールアウトしない、ブラウザメモリ上の単一セッション用イベントコレクタ。
 * 画面表示や、セッション終了前のデバッグ出力用。
 */
class DriftEventCollector {
  private events: DriftActionEvent[] = [];
  private maxItems = 100;

  constructor() {
    // 起動時に自動購読を開始
    globalDriftEventBus.subscribe((event) => {
      this.add(event);
    });
  }

  private add(event: DriftActionEvent) {
    this.events.unshift(event); // 最新を先頭に
    if (this.events.length > this.maxItems) {
      this.events.pop();
    }
  }

  public getEvents(): DriftActionEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
  }

  /** 重複（同じリスト・同じフィールド・同じ種類）を除いた要約を取得 */
  public getSummary() {
    const unique = new Map<string, DriftActionEvent>();
    for (const e of this.events) {
      const key = `${e.listKey}:${e.canonicalField || 'list'}:${e.kind}`;
      if (!unique.has(key)) {
        unique.set(key, e);
      }
    }
    return Array.from(unique.values());
  }
}

export const driftEventCollector = new DriftEventCollector();
