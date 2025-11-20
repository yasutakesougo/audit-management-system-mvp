/**
 * 現在時刻に基づくTimeBand判定フック
 *
 * 申し送りタイムライン用のユーティリティ
 * 朝/午前/午後/夕方 の自動判定とプレースホルダー文言生成
 */

import { useMemo } from 'react';
import type { TimeBand } from './handoffTypes';

/**
 * 指定日時からTimeBandを判定
 */
export function getTimeBandFromDate(date: Date): TimeBand {
  const h = date.getHours();

  if (h >= 5 && h <= 9) return '朝';
  if (h >= 10 && h <= 11) return '午前';
  if (h >= 12 && h <= 15) return '午後';
  if (h >= 16 && h <= 21) return '夕方';

  // 深夜・早朝は「朝」に寄せる
  return '朝';
}

/**
 * 現在時刻からTimeBandを取得するフック
 */
export function useCurrentTimeBand(): TimeBand {
  const band = useMemo(() => getTimeBandFromDate(new Date()), []);
  return band;
}

/**
 * TimeBandに応じたプレースホルダー文言を取得
 */
export function getTimeBandPlaceholder(timeBand: TimeBand): string {
  switch (timeBand) {
    case '朝':
      return '例）朝の来所時の様子や、前日から気になっていることなど';
    case '午前':
      return '例）午前中の活動で気になったこと、体調の変化など';
    case '午後':
      return '例）午後の活動の様子、支援の工夫、良かった場面など';
    case '夕方':
      return '例）帰り支度の様子、翌日に気をつけたいことなど';
    default:
      return '申し送り内容を記入してください';
  }
}