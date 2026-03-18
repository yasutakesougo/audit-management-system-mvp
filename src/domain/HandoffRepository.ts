import type { Handoff, HandoffPriority, HandoffStatus } from "./Handoff";

export interface CreateHandoffInput {
  userId: string;
  targetDate: string; // YYYY-MM-DD
  content: string;
  priority: HandoffPriority;
  reporterName: string;
  recordedAt: string; // ISOString
}

export interface HandoffRepository {
  /**
   * 特定の日付（または期間）の申し送りを取得する
   * 未読のみ等のフィルタリングは呼び出し側で行うか、オプションで拡張する
   */
  getHandoffsByDate(targetDate: string): Promise<Handoff[]>;

  /**
   * 対象利用者の申し送りを取得する
   */
  getHandoffsByUser(userId: string): Promise<Handoff[]>;

  /**
   * 新しい申し送りを作成する
   */
  createHandoff(input: CreateHandoffInput): Promise<Handoff>;

  /**
   * 申し送りのステータス（既読/未読）を更新する
   */
  updateHandoffStatus(id: string, newStatus: HandoffStatus): Promise<void>;
}
