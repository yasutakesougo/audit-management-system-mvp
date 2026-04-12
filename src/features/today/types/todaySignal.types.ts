export type TodaySignalPriority = 'P0' | 'P1' | 'P2';
export type SignalAudience = 'staff' | 'admin' | 'all';

export type TodaySignalCode =
  | 'daily_record_missing'
  | 'health_record_missing'
  | 'handoff_unread'
  | 'monitoring_overdue'
  | 'monitoring_due_soon'
  | 'isp_renew_suggest'
  | 'risk_health_alert';

export interface TodaySignal {
  /**
   * ユニークID（モジュール名＋対象ID等で生成。重複排除用）
   * 例: 'daily_record_missing-client123'
   */
  id: string;
  
  /** Signal種類を特定するコード */
  code: TodaySignalCode;
  
  /** 発火元のモジュール名（例: 'DailyRecord', 'Planning'） */
  domain: string;
  
  /** 表示上の重要度 */
  priority: TodaySignalPriority;
  
  /** 表示対象となる役割 */
  audience: SignalAudience[];
  
  /** UIに表示するメインテキスト */
  title: string;
  
  /** 補足情報 */
  description?: string;
  
  /** クリック時の遷移先URLパス */
  actionPath: string;
  
  /** 件数や関連エンティティIDなど、グルーピングや追加判定に使うデータ */
  metadata?: Record<string, unknown>;
}
