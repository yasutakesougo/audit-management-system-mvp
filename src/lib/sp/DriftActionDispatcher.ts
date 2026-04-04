import { globalDriftEventBus } from './onDriftEvent';
import { DriftActionEvent } from './driftEvents';
import { SpProvisioningService } from './spProvisioningService';
import { ListKeys, LIST_CONFIG } from '@/sharepoint/fields/listRegistry';
import { DAILY_RECORD_CANONICAL_ENSURE_FIELDS } from '@/sharepoint/fields/dailyFields';
import { ACTIVITY_DIARY_ENSURE_FIELDS } from '@/sharepoint/fields/activityDiaryFields';
import { MONITORING_MEETING_ENSURE_FIELDS } from '@/sharepoint/fields/monitoringMeetingFields';
import type { SpFieldDef } from './types';

/**
 * 自動修復の対象となるリスト定義のマップ
 */
const ALLOWED_AUTO_HEAL_LISTS: Record<string, SpFieldDef[]> = {
  [ListKeys.DailyRecordParent]: [...DAILY_RECORD_CANONICAL_ENSURE_FIELDS],
  [ListKeys.DailyActivityRecords]: [...ACTIVITY_DIARY_ENSURE_FIELDS],
  [ListKeys.MonitoringMeetings]: [...MONITORING_MEETING_ENSURE_FIELDS],
};

/**
 * DriftActionDispatcher — ドリフトイベントに応じた自動アクションを実行する。
 * 
 * 現時点では 'list_not_found' に対する自動プロビジョニングのみを、
 * 特定の allowlist に基づいて実行する。
 */
export class DriftActionDispatcher {
  private static instance: DriftActionDispatcher | null = null;
  private autoHealEnabled = true;

  public static init(provisioningService: SpProvisioningService): DriftActionDispatcher {
    if (this.instance) return this.instance;
    this.instance = new DriftActionDispatcher(provisioningService);
    return this.instance;
  }
  
  private processedKeys = new Map<string, number>(); // listKey -> timestamp
  private cooldownMs = 1000 * 60 * 5; // 5分間の連打防止

  private constructor(private provisioningService: SpProvisioningService) {
    globalDriftEventBus.subscribe((e) => this.handleEvent(e));
    console.log('[DriftActionDispatcher] Initialized and subscribed to drift events.');
  }

  public setEnabled(enabled: boolean) {
    this.autoHealEnabled = enabled;
  }

  private async handleEvent(event: DriftActionEvent): Promise<void> {
    // 1. 修復対象のイベントかチェック
    if (event.kind !== 'list_not_found') return;

    // 2. 自動修復が有効かチェック
    if (!this.autoHealEnabled) {
      this.notifySkipped(event, 'Auto-healing is disabled globally.');
      return;
    }

    // 3. allowlist チェック
    const ensureFields = ALLOWED_AUTO_HEAL_LISTS[event.listKey];
    if (!ensureFields) {
      this.notifySkipped(event, `List key "${event.listKey}" is not in auto-heal allowlist.`);
      return;
    }

    // 4. 重複・連打チェック
    if (this.isCoolingDown(event.listKey)) {
      this.notifySkipped(event, `Auto-heal for "${event.listKey}" skipped (cooling down).`);
      return;
    }

    // 5. 修復開始
    await this.performAutoHeal(event, ensureFields);
  }

  private isCoolingDown(listKey: string): boolean {
    const last = this.processedKeys.get(listKey);
    if (!last) return false;
    return Date.now() - last < this.cooldownMs;
  }

  private async performAutoHeal(event: DriftActionEvent, fields: SpFieldDef[]): Promise<void> {
    const listTitle = LIST_CONFIG[event.listKey as ListKeys]?.title;
    if (!listTitle) {
      this.notifySkipped(event, `List configuration not found for key: ${event.listKey}`);
      return;
    }

    this.processedKeys.set(event.listKey, Date.now());

    // 修復開始イベント
    globalDriftEventBus.emit({
      domain: event.domain,
      listKey: event.listKey,
      kind: 'auto_heal_started',
      severity: 'info',
      message: `Automatic provisioning started for list: ${listTitle}`,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.provisioningService.ensureList(listTitle, fields);
      
      globalDriftEventBus.emit({
        domain: event.domain,
        listKey: event.listKey,
        kind: 'auto_heal_succeeded',
        severity: 'info',
        message: `Automatic provisioning completed successfully for: ${listTitle}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      globalDriftEventBus.emit({
        domain: event.domain,
        listKey: event.listKey,
        kind: 'auto_heal_failed',
        severity: 'error',
        message: `Automatic provisioning failed for ${listTitle}: ${msg}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private notifySkipped(event: DriftActionEvent, reason: string): void {
    globalDriftEventBus.emit({
      domain: event.domain,
      listKey: event.listKey,
      kind: 'auto_heal_skipped',
      severity: 'info',
      message: reason,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 自動修復ディスパッチャを初期化する。
 */
export function initDriftActionDispatcher(provisioningService: SpProvisioningService) {
  return DriftActionDispatcher.init(provisioningService);
}
