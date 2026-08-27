// contract:allow-interface
import { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import { normalizeDailyRecordCommitId } from '../persistence/dailyRecordPersistence';

/**
 * 日次記録の整合性例外の種類
 */
export type DailyIntegrityExceptionType =
  | 'orphan_parent'    // 親があるが対応するバージョン+CommitIdの子が0件
  | 'version_mismatch' // Version/CommitId 不整合、または現行 identity 内の重複行
  | 'duplicate_parent' // 同一日付に SupportRecord_Daily が複数（create-race）
  | 'stale_pending'    // 書き込み中のまま一定時間経過
  | 'missing_accessory' // 必要な付随データ（送迎設定等）が欠落
  | 'count_mismatch'   // 親の userCount と現行 identity の子レコード数が不一致
  | 'scan_unknown';    // Scanner 自体が失敗。PASS と区別するための HOLD

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
  /** Required when latestVersion > 0. Absence is an integrity failure. */
  latestCommitId?: string | null;
  userCount?: number; // 親レコードに保存されている統計的な利用者数
}

export interface ScanSourceChild {
  parentId: string;
  userId: string;
  userName?: string;
  version: number;
  /** Save-attempt identity. Required for versioned current rows. */
  commitId?: string | null;
  status: string;
  recordedAt: string;
}

export interface ScanSourceAccessory {
  type: 'transport';
  userId: string;
}

function isCurrentChild(parent: ScanSourceParent, child: ScanSourceChild): boolean {
  if (parent.latestVersion <= 0) {
    return child.version === 0;
  }
  const parentCommitId = normalizeDailyRecordCommitId(parent.latestCommitId);
  const childCommitId = normalizeDailyRecordCommitId(child.commitId);
  return (
    child.version === parent.latestVersion &&
    parentCommitId !== null &&
    childCommitId === parentCommitId
  );
}

/**
 * 日次記録の整合性をスキャンする Pure Function
 */
export function scanDailyRecordIntegrity(
  parents: ScanSourceParent[],
  children: ScanSourceChild[],
  accessories: ScanSourceAccessory[] = [],
  now: Date = new Date()
): DailyIntegrityException[] {
  const exceptions: DailyIntegrityException[] = [];
  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10分

  // 0. Parent uniqueness: one SupportRecord_Daily per date (create-race residue)
  const parentsByDate = new Map<string, ScanSourceParent[]>();
  parents.forEach((parent) => {
    const bucket = parentsByDate.get(parent.date) ?? [];
    bucket.push(parent);
    parentsByDate.set(parent.date, bucket);
  });
  parentsByDate.forEach((sameDateParents, date) => {
    if (sameDateParents.length <= 1) return;
    exceptions.push({
      type: 'duplicate_parent',
      date,
      parentId: sameDateParents.map((parent) => parent.id).join(','),
      details: `Parent uniqueness violated for date ${date}: found ${sameDateParents.length} parents (Ids: ${sameDateParents.map((p) => p.id).join(', ')}). Concurrent create-race residue.`,
      severity: 'error',
      detectedAt: now.toISOString(),
    });
  });

  // 1 & 2: 親を起点としたスキャン
  parents.forEach(parent => {
    const parentChildren = children.filter(c => c.parentId === parent.id);
    const parentCommitId = normalizeDailyRecordCommitId(parent.latestCommitId);

    // LatestVersion > 0 なのに LatestCommitId が無い → Version-only current 判定を禁止
    if (parent.latestVersion > 0 && !parentCommitId) {
      exceptions.push({
        type: 'version_mismatch',
        date: parent.date,
        parentId: parent.id,
        details: `LatestVersion ${parent.latestVersion} is set but LatestCommitId is missing. Version-only current identity is prohibited.`,
        severity: 'error',
        detectedAt: now.toISOString(),
      });
    }

    const currentChildren = parentChildren.filter(c => isCurrentChild(parent, c));

    // orphan_parent: LatestVersion + LatestCommitId が指す現行子が0件
    if (parent.latestVersion > 0 && parentCommitId && currentChildren.length === 0) {
      exceptions.push({
        type: 'orphan_parent',
        date: parent.date,
        parentId: parent.id,
        details: `Parent specified v${parent.latestVersion} / CommitId ${parentCommitId} but no matching current children were found. Data may be lost or rollback failed.`,
        severity: 'error',
        detectedAt: now.toISOString(),
      });
    }

    // Version > LatestVersion ghost（未コミットの高バージョン）
    const versionGhostChildren = parentChildren.filter(c => c.version > parent.latestVersion);
    if (versionGhostChildren.length > 0) {
      exceptions.push({
        type: 'version_mismatch',
        date: parent.date,
        parentId: parent.id,
        details: `Version ghost records found! Children have version up to v${Math.max(...versionGhostChildren.map(c => c.version))}, but Parent indicates v${parent.latestVersion}.`,
        severity: 'error',
        detectedAt: now.toISOString(),
      });
    }

    // Version == LatestVersion だが CommitId != LatestCommitId（失敗/負け save の ghost）
    if (parent.latestVersion > 0 && parentCommitId) {
      const commitGhostChildren = parentChildren.filter(c => {
        if (c.version !== parent.latestVersion) return false;
        const childCommitId = normalizeDailyRecordCommitId(c.commitId);
        return childCommitId !== parentCommitId;
      });
      if (commitGhostChildren.length > 0) {
        const ghostCommitIds = [...new Set(
          commitGhostChildren
            .map(c => normalizeDailyRecordCommitId(c.commitId) ?? '(missing)')
        )];
        exceptions.push({
          type: 'version_mismatch',
          date: parent.date,
          parentId: parent.id,
          details: `CommitId ghost records found at v${parent.latestVersion}: CommitId(s) [${ghostCommitIds.join(', ')}] differ from LatestCommitId ${parentCommitId}.`,
          severity: 'error',
          detectedAt: now.toISOString(),
        });
      }
    }

    // Current Version + CommitId 内の duplicate identity
    if (parent.latestVersion > 0 && parentCommitId && currentChildren.length > 0) {
      const currentIdentityCounts = new Map<string, number>();
      currentChildren.forEach(child => {
        const identity = `${parent.id}|${parent.latestVersion}|${parentCommitId}|${child.userId}`;
        currentIdentityCounts.set(identity, (currentIdentityCounts.get(identity) ?? 0) + 1);
      });
      const duplicateUserIds = currentChildren
        .map(child => child.userId)
        .filter((userId, index, all) => all.indexOf(userId) === index)
        .filter(userId => (
          currentIdentityCounts.get(`${parent.id}|${parent.latestVersion}|${parentCommitId}|${userId}`) ?? 0
        ) > 1);

      if (duplicateUserIds.length > 0) {
        exceptions.push({
          type: 'version_mismatch',
          date: parent.date,
          parentId: parent.id,
          details: `Duplicate current identity rows found for v${parent.latestVersion} / CommitId ${parentCommitId}: ${duplicateUserIds.join(', ')}.`,
          severity: 'error',
          detectedAt: now.toISOString(),
        });
      }
    }

    const countBasisChildren = parent.latestVersion > 0
      ? currentChildren
      : parentChildren.filter(c => c.version === 0);

    // count_mismatch: 親の userCount と現行 identity の子件数を照合する
    if (parent.userCount !== undefined && parent.userCount !== countBasisChildren.length) {
      exceptions.push({
        type: 'count_mismatch',
        date: parent.date,
        parentId: parent.id,
        details: `Count mismatch: Parent indicates ${parent.userCount} users, but found ${countBasisChildren.length} current-version row(s).`,
        severity: 'warning',
        detectedAt: now.toISOString(),
      });
    }
  });

  // 3. stale_pending: 10分以上経っても committed にならない孤立行（全子レコードを直接走査）
  children.forEach(child => {
    if (child.status !== 'committed' && child.status !== 'done' && child.status !== 'completed') {
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

export function createScanUnknownException(
  details: string,
  date = 'unknown',
  detectedAt: string = new Date().toISOString(),
): DailyIntegrityException {
  return {
    type: 'scan_unknown',
    date,
    parentId: 'unknown',
    details,
    severity: 'error',
    detectedAt,
  };
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
    duplicate_parent: 'critical',
    stale_pending: 'low',
    missing_accessory: 'medium',
    count_mismatch: 'medium',
    scan_unknown: 'critical',
  };

  const titleMap: Record<DailyIntegrityExceptionType, string> = {
    orphan_parent: '[整合性異常] データの保存不全',
    version_mismatch: '[データ不整合] 重複書き込み警告',
    duplicate_parent: '[整合性異常] 同一日付の親レコード重複',
    stale_pending: '[システム遅延] 保存未完了レコード発生',
    missing_accessory: '[マスタ不整合] 付随データの欠落',
    count_mismatch: '[データ不整合] 利用者数カウント不一致',
    scan_unknown: '[整合性監査] 判定不能（HOLD）',
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
