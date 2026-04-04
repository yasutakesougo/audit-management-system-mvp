import { DriftActionEvent } from './driftEvents';
import { globalDriftEventBus } from './onDriftEvent';

/**
 * スキーマ解決の健全性を、ドメイン・リスト単位で集計。
 */
export interface DriftKpi {
  domain: string;
  listKey: string;
  totalResolutions: number;
  driftCount: number;         // fallback_success
  errorCount: number;         // essential_missing, list_not_found
  warningCount: number;       // optional_missing
  healthScore: number;       // 1.0 (完璧) 〜 0.0 (壊滅)
}

class DriftKpiAggregator {
  private stats = new Map<string, DriftKpi>();

  constructor() {
    globalDriftEventBus.subscribe((e) => this.process(e));
  }

  private process(event: DriftActionEvent): void {
    const key = `${event.domain}:${event.listKey}`;
    let kpi = this.stats.get(key);

    if (!kpi) {
      kpi = {
        domain: event.domain,
        listKey: event.listKey,
        totalResolutions: 0,
        driftCount: 0,
        errorCount: 0,
        warningCount: 0,
        healthScore: 1.0,
      };
      this.stats.set(key, kpi);
    }

    kpi.totalResolutions++;

    switch (event.kind) {
      case 'fallback_success':
        kpi.driftCount++;
        break;
      case 'essential_missing':
      case 'list_not_found':
        kpi.errorCount++;
        break;
      case 'optional_missing':
        kpi.warningCount++;
        break;
      case 'list_resolved':
        // Resolved normally if no other drift
        break;
    }

    // スコア計算 (エラー1個につき大幅減, 警告やドリフトは軽微減)
    const errPenalty = kpi.errorCount * 0.4;
    const warnPenalty = kpi.warningCount * 0.1;
    const driftPenalty = kpi.driftCount * 0.05;
    kpi.healthScore = Math.max(0, 1.0 - (errPenalty + warnPenalty + driftPenalty) / Math.max(1, kpi.totalResolutions / 10));
    // ※ 簡易的な重み。母数に合わせて正規化。
  }

  public getAllKpis(): DriftKpi[] {
    return Array.from(this.stats.values());
  }

  public getKpi(domain: string, listKey: string): DriftKpi | undefined {
    return this.stats.get(`${domain}:${listKey}`);
  }
}

export const driftKpiAggregator = new DriftKpiAggregator();
