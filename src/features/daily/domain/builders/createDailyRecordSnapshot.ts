import type { PersonDaily } from '../../../../domain/daily/types';

/**
 * 比較用の正規化されたレコードスナップショット（TypeScriptが推論しやすい形式）
 */
type NormalizedSnapshot = {
  userId: string;
  date: string;
  status: string;
  reporter: { name: string };
  data: {
    amActivities: string[];
    pmActivities: string[];
    amNotes: string;
    pmNotes: string;
    mealAmount: string;
    restraint: boolean;
    problemBehavior: {
      selfHarm: boolean;
      otherInjury: boolean;
      loudVoice: boolean;
      pica: boolean;
      other: boolean;
      otherDetail: string;
    };
    seizureRecord: {
      occurred: boolean;
      time: string;
      duration: string;
      severity: string;
      notes: string;
    };
    specialNotes: string;
    hasAttachment: boolean;
    behaviorTags: string[];
  };
};

/**
 * 日報レコードの「意味的な差分」を比較するための純関数 (Builder)
 * UIの一時状態(id, draft, timestamp)を削ぎ落とし、
 * 配列の順序や undefined/空文字 の表記ゆれを正規化して Deep Compare 可能なプレーンオブジェクトを返す。
 * 
 * @param record - フォームやDB由来の PersonDaily レコード
 * @returns 安定した比較が可能に正規化されたスナップショット
 */
export function createDailyRecordSnapshot(record: PersonDaily): NormalizedSnapshot {
  const data = record.data ?? {};

  // undefined / null を一律で空文字や false に寄せる
  const normalizeString = (val?: string | null) => (val?.trim() ?? '');
  const normalizeBoolean = (val?: boolean | null) => (val ?? false);
  
  // 配列は意味的な順序がない前提でソート（安定化）し、重複と空要素を排す
  const normalizeArray = (arr?: string[] | null) => {
    if (!arr) return [];
    const validItems = arr.map(normalizeString).filter(Boolean);
    return Array.from(new Set(validItems)).sort();
  };

  return {
    userId: normalizeString(record.userId),
    date: normalizeString(record.date),
    status: normalizeString(record.status),
    reporter: {
      name: normalizeString(record.reporter?.name),
    },
    data: {
      amActivities: normalizeArray(data.amActivities),
      pmActivities: normalizeArray(data.pmActivities),
      amNotes: normalizeString(data.amNotes),
      pmNotes: normalizeString(data.pmNotes),
      mealAmount: normalizeString(data.mealAmount),
      restraint: normalizeBoolean(data.restraint),
      problemBehavior: {
        selfHarm: normalizeBoolean(data.problemBehavior?.selfHarm),
        otherInjury: normalizeBoolean(data.problemBehavior?.otherInjury),
        loudVoice: normalizeBoolean(data.problemBehavior?.loudVoice),
        pica: normalizeBoolean(data.problemBehavior?.pica),
        other: normalizeBoolean(data.problemBehavior?.other),
        otherDetail: normalizeString(data.problemBehavior?.otherDetail),
      },
      seizureRecord: {
        occurred: normalizeBoolean(data.seizureRecord?.occurred),
        time: normalizeString(data.seizureRecord?.time),
        duration: normalizeString(data.seizureRecord?.duration),
        severity: normalizeString(data.seizureRecord?.severity),
        notes: normalizeString(data.seizureRecord?.notes),
      },
      specialNotes: normalizeString(data.specialNotes),
      hasAttachment: normalizeBoolean(data.hasAttachment),
      behaviorTags: normalizeArray(data.behaviorTags),
    },
  };
}
