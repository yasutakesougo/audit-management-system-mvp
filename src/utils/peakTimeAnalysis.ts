/**
 * 負荷集中時間分析エンジン
 * Safety HUD で「どの時間帯に問題が集中しているか」を可視化するための分析関数群
 *
 * 管理職の意思決定を支援する「次の一手」をデータドリブンで提供
 */

export type TimeSlotSummary = {
  slotLabel: string;          // '11:00-13:00' など
  hitDays: number;            // 過去N日中 何日このスロットでコンフリクトがあったか
  totalDays: number;          // 分析対象の総日数
  ratio: number;              // hitDays / totalDays の比率
  emoji: '📈' | '📉' | '➖';   // トレンド表示用絵文字
  comment: string;            // 管理職向けアドバイザリーコメント
  severity: 'high' | 'medium' | 'low'; // 重要度レベル
};

export type ConflictWithTime = {
  start: string;              // '09:30', '11:15' など HH:MM 形式
  end?: string;               // 終了時刻（オプション）
  staffId?: string;           // スタッフID（分析に利用可能）
  scheduleId?: string;        // スケジュールID（トレーサビリティ用）
};

/**
 * 時刻文字列（HH:MM）を分単位の数値に変換
 * @param timeStr 'HH:MM' 形式の時刻文字列
 * @returns 0時0分からの経過分数
 * @throws Error 不正な時刻フォーマットの場合
 */
function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error(`Invalid time string: ${timeStr}`);
  }

  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: expected HH:MM, got ${timeStr}`);
  }

  const [hStr, mStr] = parts;
  const h = Number(hStr);
  const m = Number(mStr);

  // 時間・分の数値範囲チェック
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Invalid time values: ${timeStr} (hours: ${h}, minutes: ${m})`);
  }

  return h * 60 + m;
}

/**
 * 分単位の数値を時刻文字列（HH:MM）に変換
 * @param minutes 0時0分からの経過分数
 * @returns 'HH:MM' 形式の時刻文字列
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 指定された時刻がどの時間スロットに属するかを判定
 * @param timeStr 'HH:MM' 形式の時刻
 * @param slotMinutes スロットの幅（分単位、デフォルト120分=2時間）
 * @returns 'HH:MM-HH:MM' 形式のスロットラベル
 */
function getTimeSlotLabel(timeStr: string, slotMinutes: number = 120): string {
  try {
    const totalMinutes = timeToMinutes(timeStr);
    const safeSlotMinutes = Math.max(1, Math.floor(slotMinutes)); // 最低1分単位
    const slotIndex = Math.floor(totalMinutes / safeSlotMinutes);
    const slotStart = slotIndex * safeSlotMinutes;
    const slotEnd = slotStart + safeSlotMinutes;

    return `${minutesToTime(slotStart)}-${minutesToTime(slotEnd)}`;
  } catch (error) {
    // 無効な時刻の場合は '00:00-02:00' を返してフォールバック
    console.warn(`Invalid time format in getTimeSlotLabel: ${timeStr}`, error);
    return '00:00-02:00';
  }
}

/**
 * 管理職向けアドバイザリーコメント生成
 * @param summary 時間スロットサマリー
 * @returns 具体的なアクションにつながるコメント
 */
function generateManagementComment(summary: Pick<TimeSlotSummary, 'hitDays' | 'totalDays' | 'ratio' | 'slotLabel'>): {
  comment: string;
  emoji: TimeSlotSummary['emoji'];
  severity: TimeSlotSummary['severity'];
} {
  const { hitDays, totalDays, ratio, slotLabel } = summary;

  if (ratio >= 0.6) {
    return {
      emoji: '📈',
      severity: 'high',
      comment: `過去${totalDays}日のうち${hitDays}日で${slotLabel}に予定の重なりが集中しています。シフト配置の見直しやスタッフ増員を検討してください。`,
    };
  } else if (ratio >= 0.4) {
    return {
      emoji: '📈',
      severity: 'medium',
      comment: `${slotLabel}で一定頻度の予定の重なりが発生しています。この時間帯の業務フローを見直すことをおすすめします。`,
    };
  } else if (ratio >= 0.2) {
    return {
      emoji: '➖',
      severity: 'medium',
      comment: `${slotLabel}で散発的に予定の重なりが発生しています。引き続き注意深く監視してください。`,
    };
  } else {
    return {
      emoji: '📉',
      severity: 'low',
      comment: `${slotLabel}での予定の重なり頻度は低く、安定しています。現在の配置を維持してください。`,
    };
  }
}

/**
 * 過去N日分のコンフリクト履歴から最も負荷の高い時間スロットを分析
 *
 * 使用例:
 * ```typescript
 * const history = [
 *   [{ start: '11:30' }, { start: '14:15' }], // 今日のコンフリクト
 *   [{ start: '11:45' }],                     // 昨日のコンフリクト
 *   [],                                       // 一昨日（コンフリクトなし）
 *   // ...
 * ];
 *
 * const peakSlot = summarizePeakTimeSlots(history);
 * if (peakSlot) {
 *   console.log(`負荷が高い時間帯: ${peakSlot.slotLabel}`);
 *   console.log(`${peakSlot.emoji} ${peakSlot.comment}`);
 * }
 * ```
 *
 * @param conflictHistory 過去N日分のコンフリクト配列（[今日, 昨日, 一昨日, ...]の順）
 * @param slotMinutes 分析する時間スロットの幅（分単位、デフォルト120分=2時間）
 * @returns 最も負荷の高い時間スロットの分析結果、またはnull（データ不足の場合）
 */
export function summarizePeakTimeSlots(
  conflictHistory: ConflictWithTime[][],
  slotMinutes: number = 120
): TimeSlotSummary | null {
  if (!conflictHistory.length) return null;

  // 各日でコンフリクトが発生した時間スロットを記録
  const slotHitDays = new Map<string, number>();

  conflictHistory.forEach((dayConflicts) => {
    // その日にヒットしたスロットを重複排除して記録
    const dailyHitSlots = new Set<string>();

    dayConflicts.forEach((conflict) => {
      if (!conflict.start) return;

      const slotLabel = getTimeSlotLabel(conflict.start, slotMinutes);
      dailyHitSlots.add(slotLabel);
    });

    // その日でヒットした各スロットのカウントを増加
    dailyHitSlots.forEach((slot) => {
      slotHitDays.set(slot, (slotHitDays.get(slot) ?? 0) + 1);
    });
  });

  // コンフリクトが一度も発生していない場合
  if (slotHitDays.size === 0) return null;

  // 最もヒット数の多いスロットを特定
  let peakSlot = '';
  let maxHits = 0;

  slotHitDays.forEach((hits, slot) => {
    if (hits > maxHits) {
      maxHits = hits;
      peakSlot = slot;
    }
  });

  const totalDays = conflictHistory.length;
  const ratio = maxHits / totalDays;

  const { comment, emoji, severity } = generateManagementComment({
    hitDays: maxHits,
    totalDays,
    ratio,
    slotLabel: peakSlot,
  });

  return {
    slotLabel: peakSlot,
    hitDays: maxHits,
    totalDays,
    ratio,
    emoji,
    comment,
    severity,
  };
}

/**
 * デバッグ・開発支援用: 全時間スロットの分析結果を取得
 * 運用ダッシュボードでの詳細分析に利用可能
 *
 * @param conflictHistory 過去N日分のコンフリクト配列
 * @param slotMinutes 分析する時間スロットの幅（分単位）
 * @returns 全スロットの分析結果（ヒット数降順）
 */
export function getAllTimeSlotAnalysis(
  conflictHistory: ConflictWithTime[][],
  slotMinutes: number = 120
): TimeSlotSummary[] {
  if (!conflictHistory.length) return [];

  const slotHitDays = new Map<string, number>();

  conflictHistory.forEach((dayConflicts) => {
    const dailyHitSlots = new Set<string>();

    dayConflicts.forEach((conflict) => {
      if (!conflict.start) return;

      const slotLabel = getTimeSlotLabel(conflict.start, slotMinutes);
      dailyHitSlots.add(slotLabel);
    });

    dailyHitSlots.forEach((slot) => {
      slotHitDays.set(slot, (slotHitDays.get(slot) ?? 0) + 1);
    });
  });

  const totalDays = conflictHistory.length;
  const results: TimeSlotSummary[] = [];

  slotHitDays.forEach((hits, slot) => {
    const ratio = hits / totalDays;
    const { comment, emoji, severity } = generateManagementComment({
      hitDays: hits,
      totalDays,
      ratio,
      slotLabel: slot,
    });

    results.push({
      slotLabel: slot,
      hitDays: hits,
      totalDays,
      ratio,
      emoji,
      comment,
      severity,
    });
  });

  // ヒット数の多い順でソート
  return results.sort((a, b) => b.hitDays - a.hitDays);
}

/**
 * 🎯 安定状態検知: 施設運営が安定している状況を自動検知
 * 現場スタッフのモチベーション向上を目的とした「ポジティブフィードバック」機能
 *
 * @param peakFrequency 最頻時間帯での発生日数
 * @param averageConflicts 過去7日間の平均予定重なり数
 * @param totalDays 分析対象日数（通常7日）
 * @returns 安定状態の詳細情報
 */
export type StabilityStatus = {
  isStable: boolean;
  level: 'excellent' | 'good' | 'improving' | 'needs_attention';
  emoji: '🎯' | '✅' | '📈' | '⚠️';
  message: string;
  actionSuggestion?: string;
};

export function analyzeStability(
  peakFrequency: number | undefined,
  averageConflicts: number,
  totalDays: number = 7
): StabilityStatus {
  // 負数ガード: 変なデータが来ても安全に処理
  const safePeakFreq = Math.max(0, peakFrequency ?? 0);
  const safeAvgConflicts = Math.max(0, averageConflicts);
  const safeTotalDays = Math.max(1, totalDays); // ゼロ除算防止

  const peakRatio = safePeakFreq / safeTotalDays;

  // 🎯 卓越状態: ピーク頻度が非常に低く、平均予定重なりも少ない
  if (safePeakFreq <= 1 && safeAvgConflicts <= 0.5) {
    return {
      isStable: true,
      level: 'excellent',
      emoji: '🎯',
      message: 'ここ1週間は非常に安定した運営が続いています',
      actionSuggestion: '現在の配置パターンをベースラインとして記録し、今後の基準にしましょう',
    };
  }

  // ✅ 良好状態: ピーク頻度が低く、平均予定重なりも管理できている
  if (safePeakFreq <= 2 && safeAvgConflicts <= 1.0) {
    return {
      isStable: true,
      level: 'good',
      emoji: '✅',
      message: '安定した運営状況です',
      actionSuggestion: 'この調子を維持していきましょう。定期的な振り返りで更なる改善点を探してみてください',
    };
  }

  // 📈 改善傾向: まだ予定重なりはあるが、ピーク集中は回避できている
  if (peakRatio <= 0.4 && safeAvgConflicts <= 2.0) {
    return {
      isStable: false,
      level: 'improving',
      emoji: '📈',
      message: '改善の傾向が見えています',
      actionSuggestion: '予定の重なりは発生していますが、特定時間への集中は避けられています。もう一歩で安定化できそうです',
    };
  }

  // ⚠️ 要注意: 頻繁なピークまたは高い平均予定重なり
  return {
    isStable: false,
    level: 'needs_attention',
    emoji: '⚠️',
    message: 'シフト調整の検討をお勧めします',
    actionSuggestion: 'ピーク時間帯への集中または全体的な予定の重なりが多い状況です。配置の見直しを検討してください',
  };
}

/**
 * 🌟 総合的な安全状態評価: ピーク分析と安定性分析を組み合わせた統合コメント生成
 *
 * @param peakSummary ピーク時間分析結果
 * @param stability 安定状態分析結果
 * @returns 現場向けの統合コメント
 */
export function generateIntegratedComment(
  peakSummary: TimeSlotSummary | null,
  stability: StabilityStatus
): string {
  // actionSuggestion の安全な取得
  const suggestion = stability.actionSuggestion ?? '';

  // 🎯 安定状態の場合: ポジティブフィードバックを優先
  if (stability.isStable) {
    return suggestion
      ? `${stability.emoji} ${stability.message}。${suggestion}`
      : `${stability.emoji} ${stability.message}`;
  }

  // ⚠️ 改善が必要な場合: ピーク分析 + 安定性分析の組み合わせ
  if (peakSummary && peakSummary.severity === 'high') {
    return suggestion
      ? `${peakSummary.emoji} ${peakSummary.comment} ${suggestion}`
      : `${peakSummary.emoji} ${peakSummary.comment}`;
  }

  // 📈 改善傾向の場合: 励ましのメッセージ
  if (stability.level === 'improving') {
    return suggestion
      ? `${stability.emoji} ${stability.message}。${suggestion}`
      : `${stability.emoji} ${stability.message}`;
  }

  // デフォルト: 安定性分析の結果を使用
  return suggestion
    ? `${stability.emoji} ${stability.message}。${suggestion}`
    : `${stability.emoji} ${stability.message}`;
}