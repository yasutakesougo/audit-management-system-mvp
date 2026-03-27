/**
 * 支援時間の計算（正味の分数）を行う純関数
 * 
 * @param startTime - 開始時間 (HH:mm または HH:mm:ss 形式)
 * @param endTime - 終了時間 (HH:mm または HH:mm:ss 形式)
 * @param options - 計算オプション（日跨ぎを許容するかどうかなど）
 * @returns 算出された分数（分単位）。入力が不正な場合は 0 または NaN を返す（要件定義による）
 */
export function calculateSupportDuration(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  options: { allowCrossDay?: boolean } = { allowCrossDay: false }
): number {
  if (!startTime || !endTime) {
    return 0; // 入力欠損時は0を返す
  }

  // HH:mm 形式かざっくりチェック
  const timeRegex = /^([01]\d|2[0-9]):([0-5]\d)/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return 0;
  }

  const parseMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startTotalMinutes = parseMinutes(startTime);
  let endTotalMinutes = parseMinutes(endTime);

  // 終了が開始より前の場合（日跨ぎ）
  if (endTotalMinutes < startTotalMinutes) {
    if (options.allowCrossDay) {
      endTotalMinutes += 24 * 60; // 翌日扱い
    } else {
      return 0; // 日跨ぎ禁止の場合は不正値として0
    }
  }

  return endTotalMinutes - startTotalMinutes;
}
