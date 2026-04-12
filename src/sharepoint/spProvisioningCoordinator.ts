/**
 * SharePoint Provisioning Coordinator
 * 
 * Centralized manager for:
 * 1. Batch initialization of critical lists at startup.
 * 2. Schema verification & Self-healing (Provisioning).
 * 3. Session-based caching of "Stable" status.
 * 4. Reporting stability issues to admins.
 */
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import { createProvisioningService } from '@/lib/sp/spProvisioningService';
import { reportSpHealthEvent } from '@/features/sp/health/spHealthSignalStore';
import { readBool } from '@/lib/env';
import { auditLog } from '@/lib/debugLogger';
import type { useSP } from '@/lib/spClient';
import { SP_LIST_REGISTRY, type SpListEntry } from './spListRegistry';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export type StabilityStatus = 'ok' | 'drifted' | 'missing' | 'mismatch' | 'provisioned' | 'skipped' | 'deprecated';

export interface StabilitySummary {
  key: string;
  displayName: string;
  listName: string;
  status: StabilityStatus;
  details?: string;
}

export interface BootstrapResult {
  total: number;
  healthy: number;
  unhealthy: number;
  summaries: StabilitySummary[];
}

const CACHE_PREFIX = 'sp.stable.v3:'; // Cache version bump for lifecycle
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours (session-long enough)

// ---------------------------------------------------------------------------
// Cache Helpers
// ---------------------------------------------------------------------------

function getCacheKey(listKey: string): string {
  return `${CACHE_PREFIX}${listKey}`;
}

function saveStability(listKey: string, status: StabilityStatus): void {
  try {
    const payload = JSON.stringify({
      status,
      timestamp: Date.now(),
    });
    sessionStorage.setItem(getCacheKey(listKey), payload);
  } catch {
    // ignore
  }
}

function getStability(listKey: string): StabilityStatus | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(listKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.status as StabilityStatus;
  } catch {
    return null;
  }
}

export function clearStabilityCache(): void {
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  });
}

// ---------------------------------------------------------------------------
// Coordinator Logic
// ---------------------------------------------------------------------------

export class SharePointProvisioningCoordinator {
  /**
   * App 起動時に一括初期化を実行
   * 
   * @param client  SharePoint Client (useSP() return value)
   * @param options フィルタリングやログ出力設定
   */
  static async bootstrap(
    client: ReturnType<typeof useSP>,
    options: { force?: boolean; categories?: SpListEntry['category'][] } = {}
  ): Promise<BootstrapResult> {
    const startTime = Date.now();
    trackSpEvent('sp:bootstrap_start');

    // 404 抑制のための事前一括チェック
    const existingIdentifiers = await client.getExistingListTitlesAndIds();

    const targets = SP_LIST_REGISTRY.filter(entry => {
      if (options.categories && !options.categories.includes(entry.category)) return false;
      return true;
    });

    // 最大2並列で実行 (SharePoint Throttling 回避のため低めに設定)
    const CONCURRENCY = 2;
    const summaries: StabilitySummary[] = [];
    const queue = [...targets];

    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY);
      const batchPromises = batch.map(entry => this.verifyAndProvision(client, entry, existingIdentifiers, options.force, 'bootstrap'));
      const batchResults = await Promise.all(batchPromises);
      summaries.push(...batchResults);
    }

    const result: BootstrapResult = {
      total: summaries.length,
      healthy: summaries.filter(s => s.status === 'ok' || s.status === 'provisioned' || s.status === 'drifted').length,
      unhealthy: summaries.filter(s => s.status === 'missing' || s.status === 'mismatch').length,
      summaries,
    };

    // ── Phase 1: Child Lists (Results/ApprovalLogs/UserFlags) ──
    // 既存のメインリスト provision の後に実行。fail-open (非ブロッキング) 構成。
    try {
      const provisioner = createProvisioningService(client.spFetch);
      await provisioner.ensureChildLists('bootstrap');
      trackSpEvent('sp:child_lists_provision_success');
    } catch (err) {
      // 子リストの失敗はメイン機能（L0/L1）を止めないため、警告に留めるが Signal は送る
      const errorMsg = err instanceof Error ? err.message : String(err);
      auditLog.warn('sp:provisioning', 'Child lists provisioning failed (fail-open)', { error: errorMsg });
      trackSpEvent('sp:child_lists_provision_failed', { error: errorMsg });

      reportSpHealthEvent({
        severity: 'action_required',
        reasonCode: 'sp_bootstrap_blocked',
        message: '共通子リスト（承認ログ等）の初期化に失敗しました。ガバナンス機能が制限される可能性があります。',
        source: 'realtime',
        occurredAt: new Date().toISOString()
      });
    }

    const duration = Date.now() - startTime;
    trackSpEvent('sp:bootstrap_complete', { durationMs: duration, details: { healthy: result.healthy, unhealthy: result.unhealthy } });

    return result;
  }

  /**
   * 単一リストの検証と必要に応じたプロビジョニング
   */
  private static async verifyAndProvision(
    client: ReturnType<typeof useSP>,
    entry: SpListEntry,
    existingIdentifiers: Set<string>,
    force = false,
    phase: 'bootstrap' | 'runtime' = 'runtime'
  ): Promise<StabilitySummary> {
    const listName = entry.resolve();
    const lc = entry.lifecycle;
    
    // 0. Feature Flag Check (Experimental)
    if (lc === 'experimental') {
      const flagName = `VITE_FEATURE_${entry.key.toUpperCase()}`;
      const isEnabled = readBool(flagName);
      if (!isEnabled) {
        return { key: entry.key, displayName: entry.displayName, listName, status: 'skipped', details: 'Experimental: Feature Flag is OFF' };
      }
    }

    // 0.1 Deprecated Check
    if (lc === 'deprecated') {
      auditLog.warn('sp:provisioning', `List "${listName}" is deprecated. Using with caution.`, { key: entry.key });
      return { key: entry.key, displayName: entry.displayName, listName, status: 'deprecated' };
    }

    // 1. Cache Check
    if (!force) {
      const cached = getStability(entry.key);
      if (cached === 'ok' || cached === 'provisioned') {
        return { key: entry.key, displayName: entry.displayName, listName, status: cached };
      }
    }

    const provisioner = createProvisioningService(client.spFetch);

    try {
      // 2. Existence Check (Pre-check with bulk identifiers to suppress 404 noise)
      const isOptional = lc === 'optional' || lc === 'experimental';
      const existsInBulk = existingIdentifiers.has(listName);
      
      let metadata = null;
      if (existsInBulk) {
        metadata = await client.tryGetListMetadata(listName, isOptional ? { quietStatuses: [404] } : undefined);
      }
      
      if (!metadata) {
        // If absent, check if we should provision
        if (entry.provisioningFields) {
          auditLog.warn('sp:provisioning', `List "${listName}" missing. Provisioning...`, { key: entry.key });
          await provisioner.ensureList(
              listName, 
              entry.provisioningFields as import('@/lib/sp/types').SpFieldDef[],
              { baseTemplate: entry.baseTemplate, phase }
          );
          saveStability(entry.key, 'provisioned');
          return { key: entry.key, displayName: entry.displayName, listName, status: 'provisioned' };
        }
        
        saveStability(entry.key, 'missing');
        const detail = 'List not found';
        
        if (isOptional) {
          trackSpEvent('sp:list_missing_optional', { key: entry.key, listName });
        } else {
          trackSpEvent('sp:list_missing_required', { key: entry.key, listName, error: detail });
        }
        
        return { key: entry.key, displayName: entry.displayName, listName, status: 'missing', details: detail };
      }

      // 3. Schema Check (if essentialFields defined)
      if (entry.essentialFields && entry.essentialFields.length > 0) {
        const available = await client.getListFieldInternalNames(listName);
        
        // Use fuzzy resolution to handle SharePoint suffixes (e.g., FullName0)
        const candidates = Object.fromEntries(entry.essentialFields.map(f => [f, [f]]));
        const resolution = resolveInternalNamesDetailed(available, candidates);
        const { missing: missingFields, fieldStatus } = resolution;

        if (missingFields.length > 0) {
          auditLog.warn('sp:provisioning', `Essential fields missing in "${listName}".`, { 
            key: entry.key, 
            missingFields,
            found: Array.from(available).filter(f => entry.essentialFields?.some(ef => f.toLowerCase().includes(ef.toLowerCase())))
          });

          // Attempt self-healing if provisioning fields match missing ones
          if (entry.provisioningFields) {
            auditLog.warn('sp:provisioning', `Healing ${listName}...`, { missingFields });
            await provisioner.ensureList(listName, entry.provisioningFields as import('@/lib/sp/types').SpFieldDef[], { phase });
            
            // Re-verify after healing
            const reAvailable = await client.getListFieldInternalNames(listName);
            const { missing: stillMissing } = resolveInternalNamesDetailed(reAvailable, candidates);
            if (stillMissing.length === 0) {
              saveStability(entry.key, 'provisioned');
              return { key: entry.key, displayName: entry.displayName, listName, status: 'provisioned' };
            }
          }
          
          saveStability(entry.key, 'mismatch');

          // [Hardening Phase B] 必須列欠落を Signal として報告
          if (!isOptional) {
            reportSpHealthEvent({
              severity: 'critical',
              reasonCode: 'sp_bootstrap_blocked',
              listName,
              message: `「${listName}」で必須フィールドが欠落しています: ${missingFields.join(', ')}`,
              source: 'realtime',
              occurredAt: new Date().toISOString()
            });
          }

          return { 
            key: entry.key, 
            displayName: entry.displayName, 
            listName, 
            status: 'mismatch', 
            details: `Missing: ${missingFields.join(', ')}` 
          };
        }

        // 4. Drift Check
        const driftDetails = Object.entries(fieldStatus)
          .filter(([_, s]) => s.isDrifted)
          .map(([key, s]) => `${key} -> ${s.resolvedName}`);

        if (driftDetails.length > 0) {
          auditLog.warn('sp:provisioning', `List "${listName}" has schema drift.`, { drift: driftDetails });
          saveStability(entry.key, 'drifted');

          // [Hardening Phase B] ドリフトを Signal として報告
          reportSpHealthEvent({
            severity: 'warning',
            reasonCode: 'sp_schema_drift',
            listName,
            message: `「${listName}」で列名のドリフト（末尾への _0 付与等）を検出しました: ${driftDetails.join(', ')}`,
            source: 'realtime',
            occurredAt: new Date().toISOString(),
            remediation: {
              summary: '不整合を起こしている重複列（ドリフト列）の削除を推奨します。',
              commands: driftDetails.map(d => {
                const driftedName = d.split(' -> ')[1];
                return `m365 spo field remove --webUrl $SITE_URL --listTitle "${listName}" --internalName "${driftedName}" --confirm`;
              }),
              caution: '削除前に対象の列にデータが入っていないか、または重複している本物の列があるかを確認してください。',
              isDestructive: true
            }
          });

          return { 
            key: entry.key, 
            displayName: entry.displayName, 
            listName, 
            status: 'drifted',
            details: `Drift: ${driftDetails.join(', ')}`
          };
        }
      }

      // 4. Final Success
      saveStability(entry.key, 'ok');
      return { key: entry.key, displayName: entry.displayName, listName, status: 'ok' };

    } catch (err) {
      const isOptional = lc === 'optional' || lc === 'experimental';
      const is404 = (err as { status?: number }).status === 404;

      const errorMsg = err instanceof Error ? err.message : String(err);

      if (isOptional && is404) {
        trackSpEvent('sp:list_missing_optional', { key: entry.key, listName });
      } else {
        trackSpEvent('sp:provision_failed', { key: entry.key, listName, error: errorMsg });

        // [Hardening Phase C] 必須リストのプロビジョニング失敗を Hard Fail Signal 
        if (!isOptional) {
          reportSpHealthEvent({
            severity: 'critical',
            reasonCode: 'sp_bootstrap_blocked',
            listName,
            message: `「${listName}」のプロビジョニング中に致命的なエラーが発生しました: ${errorMsg}`,
            source: 'realtime',
            occurredAt: new Date().toISOString()
          });
        }
      }

      saveStability(entry.key, isOptional ? 'missing' : 'mismatch');
      return { 
        key: entry.key, 
        displayName: entry.displayName, 
        listName, 
        status: isOptional ? 'missing' : 'mismatch',
        details: errorMsg
      };
    }
  }

  /**
   * レポジトリ側から安定状態を確認するためのヘルパー
   */
  static isStable(listKey: string): boolean {
    const s = getStability(listKey);
    return s === 'ok' || s === 'provisioned' || s === 'drifted';
  }

  /**
   * 単一リストの整合性チェック (外部・テスト用)
   */
  async checkFieldIntegrity(
    client: ReturnType<typeof useSP>,
    listKey: string
  ): Promise<{ 
    isValid: boolean; 
    missingFields: string[]; 
    details?: string;
    entry?: SpListEntry;
  }> {
    const entry = SP_LIST_REGISTRY.find(e => e.key === listKey);
    if (!entry) {
      return { 
        isValid: false, 
        missingFields: [], 
        details: `List key "${listKey}" is not registered in SP_LIST_REGISTRY.` 
      };
    }

    // verifyAndProvision を呼び出して現在の状態を確認
    // Bootstrap 結果とは異なり、既存リスト一覧は個別に fetch する
    const summary = await (this.constructor as typeof SharePointProvisioningCoordinator).verifyAndProvision(
      client, 
      entry, 
      new Set([entry.resolve()]), // 存在前提でチェック開始
      true // キャッシュを無視して最新を取得
    );

    const isHealthy = summary.status === 'ok' || summary.status === 'provisioned' || summary.status === 'drifted';
    
    // Status 'mismatch' の場合に details から不足列を取り出す
    const missing = summary.details?.startsWith('Missing:') 
      ? summary.details.replace('Missing: ', '').split(', ') 
      : [];

    return {
      isValid: isHealthy,
      missingFields: missing,
      details: summary.details,
      entry
    };
  }
}

/**
 * Singleton instance for UI/Granular checks
 */
export const spProvisioningCoordinator = new SharePointProvisioningCoordinator();
