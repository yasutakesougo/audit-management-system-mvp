/**
 * @fileoverview 通知監査ログのリポジトリ実装 (LocalStorage)
 */
import type { NotificationAuditLog, NotificationAuditRepository } from '../domain/notificationAuditTypes';

const STORAGE_KEY = 'isokatsu_notification_audit_logs';

export const localNotificationAuditRepository: NotificationAuditRepository = {
  async save(log: NotificationAuditLog): Promise<void> {
    const all = await this.getAll();
    all.push(log);
    
    // 最大 500 件で古いものからトリミング
    const trimmed = all.slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  },

  async getAll(): Promise<NotificationAuditLog[]> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async getByExceptionId(exceptionId: string): Promise<NotificationAuditLog[]> {
    const all = await this.getAll();
    return all.filter(l => l.sourceExceptionId === exceptionId);
  },

  async clearLegacyLogs(days: number): Promise<number> {
    const all = await this.getAll();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    
    const filtered = all.filter(l => new Date(l.createdAt) >= threshold);
    const removedCount = all.length - filtered.length;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return removedCount;
  }
};
