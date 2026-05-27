import { useCallback } from 'react';
import { useProcedureData } from './useProcedureData';
import { useExecutionData } from './useExecutionData';
import { makeRecordId } from '../domain/executionRecordTypes';
import { formatInTimeZone } from '@/lib/tz';
import type { AbcRecordSourceContext } from '@/domain/abc/abcRecord';

export function useAbcDailySupportIntegration() {
  const procedureRepo = useProcedureData();
  const executionRepo = useExecutionData();

  const linkExecutionRecord = useCallback(async (
    userId: string,
    behavior: string,
    consequence: string,
    sourceContext: AbcRecordSourceContext,
    recorderName: string
  ) => {
    if (sourceContext.source !== 'daily-support') return;

    const date = sourceContext.date || formatInTimeZone(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const slotId = sourceContext.slotId; // 例: "09:30|通所・朝の準備"

    if (!slotId) return;

    const parts = slotId.split('|');
    const targetTime = parts[0];
    const targetActivity = parts[1];

    // ユーザーの支援手順を取得
    const steps = procedureRepo.getByUser(userId);
    const matchingStep = steps.find(
      (step) => step.time === targetTime && step.activity === targetActivity
    );

    if (!matchingStep) return;

    const scheduleItemId = matchingStep.rowNo !== undefined
      ? String(matchingStep.rowNo)
      : matchingStep.id;

    if (!scheduleItemId) return;

    // 既存の実施記録を取得
    const existing = await executionRepo.getRecord(date, userId, scheduleItemId);

    const abcMemo = `【メモ】[ABC記録] 行動: ${behavior.trim()}\n結果: ${consequence.trim()}`;

    const nextRecord = {
      id: makeRecordId(date, userId, scheduleItemId),
      date,
      userId,
      scheduleItemId,
      status: 'completed' as const,
      triggeredBipIds: existing?.triggeredBipIds || [],
      memo: abcMemo,
      recordedBy: recorderName || existing?.recordedBy || '',
      recordedAt: new Date().toISOString(),
    };

    await executionRepo.upsertRecord(nextRecord);
  }, [procedureRepo, executionRepo]);

  return { linkExecutionRecord };
}
