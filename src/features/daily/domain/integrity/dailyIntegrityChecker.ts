import { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';

/**
 * 日次記録の整合性例外の種類
 */
export type DailyIntegrityExceptionType = 
  | 'orphan_parent'    // 親があるが対応するバージョンの子が0件
  | 'version_mismatch' // 親のバージョンと一致しない子が混在（不整合）
  | 'stale_pending'    // 書き込み中のまま一定時間経過
  | 'missing_accessory'; // 必要な付随データ（送迎設定等）が欠落

/**
 * 日次記録の不整合データ（内部表現）
 */
export interface DailyIntegrityException {
  type: DailyIntegrityExceptionType;
  date: string;
  parentId: string;
  details: string;
  severity: 'warning' | 'error';
  detectedAt: string;
}

/**
 * 検知対象のデータモデル
 */
export interface ScanSourceParent {
  id: string;
  date: string;
  latestVersion: number;
}

export interface ScanSourceChild {
  parentId: string;
  userId: string;
  userName?: string;
  version: number;
  status: string;
  recordedAt: string;
}

export interface ScanSourceAccessory {
  type: 'transport';
  userId: string;
}

/**
 * 日次記録の不整合をスキャンする Pure Function
 */
export function scanDailyRecordIntegrity(
  parents: ScanSourceParent[],
  children: ScanSourceChild[],
  accessories: ScanSourceAccessory[] = [],
  now: Date = new Date()
): DailyIntegrityException[] {
  const exceptions: DailyIntegrityException[] = [];
  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10分

  // 1 & 2: 親を起点としたスキャン
  parents.forEach(parent => {
    const parentChildren = children.filter(c => c.parentId === parent.id);
    const latestVersionChildren = parentChildren.filter(c => c.version === parent.latestVersion);

    // orphan_parent: 最新バージョンとしてマークされているが、子が1件も存在しない（保存が親更新直前で止まった可能性）
    if (parent.latestVersion > 0 && latestVersionChildren.length === 0) {
      exceptions.push({
        type: 'orphan_parent',
        date: parent.date,
        parentId: parent.id,
        details: `Parent specified v${parent.latestVersion} but no children found for this version. Data may be lost or rollback failed.`,
        severity: 'error',
        detectedAt: now.toISOString(),
      });
    }

    // version_mismatch: 親の LatestVersion を超えるバージョンを持つ子が存在する（ゴーストライト）
    const ghostChildren = parentChildren.filter(c => c.version > parent.latestVersion);
    if (ghostChildren.length > 0) {
      exceptions.push({
        type: 'version_mismatch',
        date: parent.date,
        parentId: parent.id,
        details: `Ghost records found! Children have version up to v${Math.max(...ghostChildren.map(c => c.version))}, but Parent indicates v${parent.latestVersion}.`,
        severity: 'error',
        detectedAt: now.toISOString(),
      });
    }
  });

  // 3. stale_pending: 10分以上経っても committed にならない孤立行（全子レコードを直接走査）
  children.forEach(child => {
    if (child.status !== 'committed' && child.status !== 'done') {
      const recordedAtTime = new Date(child.recordedAt).getTime();
      if (now.getTime() - recordedAtTime > STALE_THRESHOLD_MS) {
        exceptions.push({
          type: 'stale_pending',
          date: 'unknown',
          parentId: child.parentId,
          details: `Stale save detected: User ${child.userName || child.userId} record stuck in status '${child.status}' since ${child.recordedAt}.`,
          severity: 'warning',
          detectedAt: now.toISOString(),
        });
      }
    }
  });

  // 4. missing_accessory: 子レコード（利用者行）があるが、必要な付随データが存在しない
  // 現在は transport (UserTransport_Settings) のみを対象とする
  const transportUserIds = new Set(accessories.filter(a => a.type === 'transport').map(a => a.userId));
  
  children.forEach(child => {
    // 削除済みや無効な ID はスキップ（親が見つからない場合は orphan 側で処理される可能性があるが、ここでは子起点）
    const parent = parents.find(p => p.id === child.parentId);
    if (!parent) return;

    if (!transportUserIds.has(child.userId)) {
      exceptions.push({
        type: 'missing_accessory',
        date: parent.date,
        parentId: child.parentId,
        details: `Accessory data missing: User ${child.userName || child.userId} has no Transport settings record.`,
        severity: 'warning',
        detectedAt: now.toISOString(),
      });
    }
  });

  return exceptions;
}

/**
 * DailyIntegrityException を ExceptionCenter 用の共通モデルへ変換する
 */
export function mapIntegrityToExceptionItem(
  exc: DailyIntegrityException
): ExceptionItem {
  const severityMap: Record<DailyIntegrityExceptionType, 'critical' | 'high' | 'medium' | 'low'> = {
    orphan_parent: 'high',
    version_mismatch: 'medium',
    stale_pending: 'low',
    missing_accessory: 'medium',
  };

  const titleMap: Record<DailyIntegrityExceptionType, string> = {
    orphan_parent: '[整合性異常] データの保存不全',
    version_mismatch: '[データ不整合] 重複書き込み警告',
    stale_pending: '[システム遅延] 保存未完了レコード発生',
    missing_accessory: '[マスタ不整合] 付随データの欠落',
  };

  return {
    id: `integrity-${exc.type}-${exc.parentId}-${exc.detectedAt}`,
    category: 'data-os-alert',
    severity: severityMap[exc.type] || 'medium',
    title: titleMap[exc.type],
    description: `日付: ${exc.date} / ID: ${exc.parentId}\n${exc.details}`,
    targetDate: exc.date !== 'unknown' ? exc.date : undefined,
    updatedAt: exc.detectedAt,
    actionLabel: '詳細データを修復',
    actionPath: `/admin/integrity-debug?id=${exc.parentId}`,
  };
}
