export interface TimeRange {
  id?: string | number; // 既存レコードのID (自己を除外するため)
  startTime: string | null | undefined;
  endTime: string | null | undefined;
}

export interface ValidateTimeOverlapResult {
  hasOverlap: boolean;
  overlappingRecords: TimeRange[];
}

/**
 * 時間重複を検証する純関数
 * 
 * @param targetRecord 検証対象のレコード
 * @param existingRecords 比較対象となる既存レコードのリスト
 * @param options 同じIDを除外するかなどのオプション
 */
export function validateTimeOverlap(
  targetRecord: TimeRange,
  existingRecords: TimeRange[],
  options: { excludeSelfId?: string | number } = {}
): ValidateTimeOverlapResult {
  if (!targetRecord.startTime || !targetRecord.endTime) {
    return { hasOverlap: false, overlappingRecords: [] };
  }

  // 時間文字列(HH:mm)を比較可能な分（数値）に変換
  const toMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const tStart = toMinutes(targetRecord.startTime);
  const tEnd = toMinutes(targetRecord.endTime);

  // 開始 >= 終了の場合（不正入力 または 日跨ぎ未対応）は重複検証不可として判定から外す
  if (tStart >= tEnd) {
    return { hasOverlap: false, overlappingRecords: [] };
  }

  const overlapping: TimeRange[] = [];

  for (const record of existingRecords) {
    // 自身のIDが指定してあれば除外
    if (options.excludeSelfId !== undefined && record.id === options.excludeSelfId) {
      continue;
    }
    
    // 不適格なレコードはスキップ
    if (!record.startTime || !record.endTime) {
      continue;
    }

    const rStart = toMinutes(record.startTime);
    const rEnd = toMinutes(record.endTime);
    
    if (rStart >= rEnd) {
      continue;
    }

    // 重複条件： (ターゲットの開始 < 既存の終了) AND (ターゲットの終了 > 既存の開始)
    // エッジケース（接する）は重複とみなさない (target.end == record.start)
    if (tStart < rEnd && tEnd > rStart) {
      overlapping.push(record);
    }
  }

  return {
    hasOverlap: overlapping.length > 0,
    overlappingRecords: overlapping,
  };
}
