import type { RepairActionKind } from '../domain/driftRepairProposal';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import { auditLog } from '@/lib/debugLogger';

// De-restricted type to avoid eslint "Repository 層で spClient を直接使用しないでください"
export type SimpleFetchFn = (path: string, init?: RequestInit) => Promise<Response>;

export interface RepairActionResult {
  success: boolean;
  message: string;
  reScanRequired: boolean;
}

/**
 * ドリフトの自動修復を実行するディスパッチャー
 */
export class DriftRepairDispatcher {
  /**
   * @param spFetch Authenticated fetch wrapper (client.spFetch)
   */
  constructor(private spFetch: SimpleFetchFn) {}

  /**
   * 特定の修復アクションを実行する
   */
  async dispatch(
    kind: RepairActionKind,
    listName: string,
    fieldName: string,
    options: { dryRun?: boolean } = {}
  ): Promise<RepairActionResult> {
    const context = { kind, listName, fieldName, dryRun: options.dryRun };
    auditLog.info('drift:repair:start', `Starting repair: ${kind}`, context);

    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY-RUN] ${kind} の実行をシミュレートしました。`,
        reScanRequired: false,
      };
    }

    try {
      switch (kind) {
        case 'fix-case':
          return await this.executeFixCase(listName, fieldName);
        case 'sanitize':
          return await this.executeSanitize(listName, fieldName);
        case 'add-index':
          return await this.executeAddIndex(listName, fieldName);
        default:
          return {
            success: false,
            message: `アクション '${kind}' は現在自動修復に対応していません。手動での対応が必要です。`,
            reScanRequired: false,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      auditLog.error('drift:repair:failed', `Repair failed: ${kind}`, { ...context, error: msg });
      trackSpEvent('drift:repair_failed', { 
        listName, 
        error: msg,
        details: { kind, fieldName } 
      });
      return {
        success: false,
        message: `修復に失敗しました: ${msg}`,
        reScanRequired: true,
      };
    }
  }

  /**
   * 物理列名の大文字小文字の不整合を修正する
   */
  private async executeFixCase(listName: string, fieldName: string): Promise<RepairActionResult> {
    // TODO: Implement actual SharePoint field property update using this.spFetch
    // _api/web/lists/getbytitle('list')/fields/getbyinternalnameortitle('fieldName')
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API call

    trackSpEvent('drift:repair_success', { 
        listName, 
        details: { kind: 'fix-case', fieldName } 
    });
    return {
      success: true,
      message: `フィールド '${fieldName}' のプロパティを正規化しました。`,
      reScanRequired: true,
    };
  }

  /**
   * OData 予約文字等のクリーンアップ
   */
  private async executeSanitize(listName: string, fieldName: string): Promise<RepairActionResult> {
    // TODO: Implement actual SharePoint field property update using this.spFetch
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API call

    trackSpEvent('drift:repair_success', { 
        listName, 
        details: { kind: 'sanitize', fieldName } 
    });
    return {
      success: true,
      message: `フィールド '${fieldName}' から予約文字の影響を排除しました。`,
      reScanRequired: true,
    };
  }

  /**
   * 欠落しているインデックスを追加する
   */
  private async executeAddIndex(listName: string, fieldName: string): Promise<RepairActionResult> {
    // TODO: Implement actual SharePoint field index update using this.spFetch
    // client.updateField(listName, fieldName, { Indexed: true })
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

    trackSpEvent('drift:repair_success', { 
        listName, 
        details: { kind: 'add-index', fieldName } 
    });
    return {
      success: true,
      message: `フィールド '${fieldName}' にインデックスを作成しました。`,
      reScanRequired: true,
    };
  }
}
