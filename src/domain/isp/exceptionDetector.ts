/**
 * Exception Trigger Detector (Pure Logic)
 * 
 * 計画 (DailyGuidanceBundle) と 実績 (PersonDaily) の照合を行い、
 * 逸脱点、未実施、不備を自動検知する純粋関数。
 */

import type { DailyGuidanceBundle } from './dailyBridge';
import type { PersonDaily } from '@/domain/daily/types';
import type { TriggeredException, ExceptionSeverity } from './exceptionBridge';

/**
 * 計画と記録のズレを検知する。
 */
export function detectPlanningDailyExceptions(
  guidance: DailyGuidanceBundle,
  record: PersonDaily | null,
  currentTime: string = new Date().toISOString()
): TriggeredException[] {
  const exceptions: TriggeredException[] = [];
  const detectedAt = currentTime;

  // 1. 未実施の検知 (Unperformed)
  // 手順 (procedure) が配備されているが、記録ステータスが「完了」ではない
  const procedures = guidance.items.filter(i => i.type === 'procedure');
  const currentHour = new Date(currentTime).getHours();

  if (procedures.length > 0) {
    if (!record || record.status !== '完了') {
      // 16時を過ぎていたら重要度を上げる
      const severity: ExceptionSeverity = currentHour >= 16 ? 'critical' : 'warning';
      
      exceptions.push({
        id: `exc-unperformed-${guidance.userId}-${detectedAt}`,
        category: 'unperformed',
        severity,
        title: '支援手順の完了確認ができていません',
        reason: `${procedures.length}件の手順項目の配備があるのに対し、現在ステータスは「${record?.status || '未作成'}」です。`,
        suggestedAction: '実施記録を確認し、ステータスを完了に更新してください。',
        provenance: { userId: guidance.userId, detectedAt },
        isResolved: false,
        expectedContent: '完了',
        observedContent: record?.status || '未作成'
      });
    }
  }

  // 2. 重点観察の記述漏れの検知 (Missing Focus)
  // 重点観察ポイント (focus) のキーワードが記録内容 (specialNotes) に含まれているかを確認（簡易的な照合）
  const focuses = guidance.items.filter(i => i.type === 'focus');
  if (record && record.status === '完了' && focuses.length > 0) {
    const notes = record.data.specialNotes || '';
    
    focuses.forEach(focus => {
      // ガイダンスの文言の一部でも含まれているか（現場語の揺らぎは今後の課題）
      const keywords = focus.content.split(' ').filter(k => k.length > 3);
      const isMentioned = keywords.some(k => notes.includes(k));
      
      if (!isMentioned && keywords.length > 0) {
        exceptions.push({
          id: `exc-missing-focus-${focus.id}-${detectedAt}`,
          category: 'missing_focus',
          severity: 'info',
          title: '重点観察ポイントの記述不備の可能性',
          reason: `計画された観察重点「${focus.title}」について、記録の記述内容との照合に失敗しました。`,
          suggestedAction: '記録内容を見直し、観察ポイントへの言及を追加することを推奨します。',
          provenance: { userId: guidance.userId, sourceGuidanceId: focus.id, sourceRecordId: record.id, detectedAt },
          isResolved: false,
          expectedContent: focus.content,
          observedContent: notes
        });
      }
    });
  }

  // 3. 高リスク注意点と実績の照合 (Risk Detected)
  // 例: caution に「発作」が含まれるが、発作記録の有無が不鮮明な場合など
  const cautions = guidance.items.filter(i => i.type === 'caution');
  if (record && cautions.some(c => c.content.includes('発作') || c.title.includes('発作'))) {
    const seizureOccurred = record.data.seizureRecord?.occurred;
    if (seizureOccurred === undefined) {
      exceptions.push({
        id: `exc-risk-unknown-${guidance.userId}-${detectedAt}`,
        category: 'risk_detected',
        severity: 'critical',
        title: '発作の有無に関する記録が不足しています',
        reason: '注意点として発作の警戒が配備されていますが、本日の記録に発作の有無の情報がありません。',
        suggestedAction: '発作の有無（「なし」の場合も含む）を直ちに記録してください。',
        provenance: { userId: guidance.userId, sourceRecordId: record.id, detectedAt },
        isResolved: false
      });
    }
  }

  return exceptions;
}

/**
 * サマリ情報の構築
 */
export function summarizeTriggeredExceptions(exceptions: TriggeredException[]) {
  return {
    criticalCount: exceptions.filter(e => e.severity === 'critical').length,
    warningCount: exceptions.filter(e => e.severity === 'warning').length,
    totalActiveExceptions: exceptions.length,
    topActionLabels: exceptions.slice(0, 3).map(e => e.title)
  };
}

import type { IUserMaster } from '@/sharepoint/fields';

/**
 * 【MVP/デモ用】全利用者の実績から例外を一括生成する。
 * 本来は Repository から各利用者の GuidanceBundle を取得して detectPlanningDailyExceptions を回す。
 */
export function simulateAllTodayExceptions(
  records: PersonDaily[],
  users: IUserMaster[]
): TriggeredException[] {
  const allExceptions: TriggeredException[] = [];
  const now = new Date();
  const currentHour = now.getHours();

  records.forEach(record => {
    // 1. 完了していない記録に対する例外 (Unperformed)
    if (record.status !== '完了' && currentHour >= 14) {
      allExceptions.push({
        id: `exc-auto-unperformed-${record.userId}`,
        category: 'unperformed',
        severity: currentHour >= 16 ? 'critical' : 'warning',
        title: '支援記録が未完了です',
        reason: `本日のサービス提供が終盤ですが、ステータスが「${record.status}」のままです。`,
        suggestedAction: '実施内容を確認し、記録を完了させてください。',
        provenance: { userId: record.userId, detectedAt: now.toISOString() },
        isResolved: false
      });
    }

    // 2. リスクが高い利用者での記録不備 (特定のモック条件)
    const user = users.find(u => u.UserID === record.userId);
    if (user?.IsSupportProcedureTarget && record.status === '完了') {
      // 記述が極端に短い場合など
      if ((record.data.specialNotes || '').length < 10) {
        allExceptions.push({
          id: `exc-auto-short-note-${record.userId}`,
          category: 'missing_focus',
          severity: 'warning',
          title: '観察記録の記述が不足しています',
          reason: '強化支援対象者ですが、特記事項の記述が不十分な可能性があります。',
          suggestedAction: '本日の重点観察ポイントに基づき、具体的な様子を追記してください。',
          provenance: { userId: record.userId, sourceRecordId: record.id, detectedAt: now.toISOString() },
          isResolved: false
        });
      }
    }
  });

  return allExceptions;
}

/**
 * 特定の例外が最新の記録によって解決されたかを判定する。
 */
export function isExceptionResolved(
  exception: TriggeredException,
  record: PersonDaily | null
): boolean {
  if (!record) return false;

  switch (exception.category) {
    case 'unperformed':
      // 記録ステータスが完了になっていれば解決
      return record.status === '完了';

    case 'missing_focus': {
      // 記述が不足していなければ（10文字以上かつキーワードが含まれていれば）解決
      if (record.status !== '完了') return false;
      const notes = record.data.specialNotes || '';
      return notes.length >= 10;
    }

    case 'risk_detected':
      // 発作等のリスク確認が「あり/なし」どちらかで入力されていれば解決
      return record.data.seizureRecord?.occurred !== undefined;

    default:
      return false;
  }
}
