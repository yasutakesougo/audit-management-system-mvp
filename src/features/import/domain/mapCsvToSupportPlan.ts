// ---------------------------------------------------------------------------
// mapCsvToSupportPlan — ScheduleItem[] → SupportPlanDeployment 変換
//
// CSVパーサーが出力した ScheduleItem[] を、time-flow ビューが必要とする
// SupportPlanDeployment 形式にラップする純粋関数。
// ---------------------------------------------------------------------------
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import type {
    SupportActivityTemplate,
    SupportPlanDeployment,
    SupportStrategyStage,
} from '@/features/planDeployment/supportFlow';

// ---------------------------------------------------------------------------
// Stage 推定ヒューリスティック
//
// 時間帯から支援戦略ステージを推定する。
// - 09:00–10:59 → proactive（予防的）
// - 11:00–12:59 → earlyResponse（早期対応）
// - 13:00–14:59 → proactive（午後の活動）
// - 15:00–       → postCrisis（振り返り・クールダウン）
// ---------------------------------------------------------------------------

/**
 * HH:MM 形式の時間文字列から戦略ステージを推定する。
 */
export function inferStageFromTime(time: string): SupportStrategyStage {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 'proactive';

  const hour = parseInt(match[1], 10);

  if (hour < 11) return 'proactive';
  if (hour < 13) return 'earlyResponse';
  if (hour < 15) return 'proactive';
  return 'postCrisis';
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

export interface MapSupportPlanOptions {
  /** 計画名 (デフォルト: `${userId} 支援計画`) */
  planName?: string;
  /** 作成者名 */
  author?: string;
  /** バージョン文字列 (デフォルト: '1.0') */
  version?: string;
}

/**
 * ScheduleItem[] を SupportPlanDeployment に変換する。
 *
 * @param userId - 対象ユーザーID
 * @param items - CSVパーサーから出力された ScheduleItem 配列
 * @param options - 計画メタデータのオプション
 * @returns SupportPlanDeployment
 *
 * @example
 * ```ts
 * const deployment = mapScheduleToSupportPlan('I001', scheduleItems, {
 *   planName: '田中さん日課表',
 *   author: 'CSVインポート',
 * });
 * ```
 */
export function mapScheduleToSupportPlan(
  userId: string,
  items: ScheduleItem[],
  options: MapSupportPlanOptions = {},
): SupportPlanDeployment {
  const {
    planName = `${userId} 支援計画`,
    author = 'CSVインポート',
    version = '1.0',
  } = options;

  const activities: SupportActivityTemplate[] = items.map((item) => ({
    time: item.time,
    title: item.activity.split(' - ')[0] || item.activity,
    personTodo: item.activity.includes(' - ')
      ? item.activity.split(' - ').slice(1).join(' - ')
      : item.activity,
    supporterTodo: item.instruction || '支援内容を設定してください',
    stage: inferStageFromTime(item.time),
  }));

  return {
    planId: `import-${userId}`,
    planName,
    version,
    deployedAt: new Date().toISOString(),
    author,
    activities,
    summary: `CSVインポートによる支援計画（${activities.length}件の活動）`,
  };
}
