/**
 * useChangeDetection — 値の変化を検出する汎用 hook (P5-C3)
 *
 * 前回レンダリング時の値と比較して、変化検出 + 一時ハイライトを管理する。
 * Thin Component の原則を崩さず、UI の "変化の認知" を提供する。
 *
 * 責務:
 *  - 前回値の記憶 (useRef)
 *  - 差分計算 (delta)
 *  - 一時ハイライトフラグの自動リセット
 */

import { useEffect, useRef, useState } from 'react';

// ────────────────────────────────────────────
// 型
// ────────────────────────────────────────────

export type ChangeStatus = {
  /** 値が変化した直後か（一時フラグ、自動リセット） */
  justChanged: boolean;
  /** 差分（現在 - 前回）。undefinedなら初回 */
  delta?: number;
  /** 前回の値 */
  previous?: number;
};

// ────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────

/** ハイライト表示の持続時間 (ms) */
const HIGHLIGHT_DURATION = 1500;

/**
 * 数値の変化を検出し、差分とハイライトフラグを返す。
 *
 * - 初回レンダリングでは justChanged=false, delta=undefined
 * - 値が変わると justChanged=true になり、HIGHLIGHT_DURATION 後に自動リセット
 * - delta は 現在値 - 前回値
 *
 * @param value - 監視する数値
 * @returns ChangeStatus
 */
export function useNumberChange(value: number): ChangeStatus {
  const prevRef = useRef<number | undefined>(undefined);
  const [justChanged, setJustChanged] = useState(false);
  const [delta, setDelta] = useState<number | undefined>(undefined);
  const [previous, setPrevious] = useState<number | undefined>(undefined);

  useEffect(() => {
    const prev = prevRef.current;

    if (prev !== undefined && prev !== value) {
      setDelta(value - prev);
      setPrevious(prev);
      setJustChanged(true);

      const timer = setTimeout(() => {
        setJustChanged(false);
      }, HIGHLIGHT_DURATION);

      prevRef.current = value;
      return () => clearTimeout(timer);
    }

    prevRef.current = value;
  }, [value]);

  return { justChanged, delta, previous };
}

/**
 * 浮動小数点率（0-1）の変化を検出する。
 * numberChange と同様だが、delta は率の差分。
 */
export function useRateChange(value: number | undefined): ChangeStatus & {
  /** 変化の方向を示すアイコン文字 */
  directionIcon: '↑' | '↓' | '';
} {
  const prevRef = useRef<number | undefined>(undefined);
  const [justChanged, setJustChanged] = useState(false);
  const [delta, setDelta] = useState<number | undefined>(undefined);
  const [previous, setPrevious] = useState<number | undefined>(undefined);

  useEffect(() => {
    const prev = prevRef.current;

    if (prev !== undefined && value !== undefined && prev !== value) {
      setDelta(value - prev);
      setPrevious(prev);
      setJustChanged(true);

      const timer = setTimeout(() => {
        setJustChanged(false);
      }, HIGHLIGHT_DURATION);

      prevRef.current = value;
      return () => clearTimeout(timer);
    }

    prevRef.current = value;
  }, [value]);

  const directionIcon = delta === undefined ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '';

  return { justChanged, delta, previous, directionIcon };
}
