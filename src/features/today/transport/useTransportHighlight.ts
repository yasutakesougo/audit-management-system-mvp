/**
 * useTransportHighlight — ExceptionCenter からの deep link を処理する hook
 *
 * URL パラメータ `?highlight=userCode&direction=to|from` を読み取り、
 * Transport カードの自動タブ切り替え + ユーザーハイライトを制御する。
 *
 * ## 設計意図
 * - ExceptionCenter の「停滞中の送迎を確認」CTA → `/today?highlight=U001&direction=to`
 * - TodayOpsPage 側で URL を読み、transport の activeDirection を自動切り替え
 * - TransportStatusCard に highlightUserId を渡してハイライト表示
 * - ハイライトは一定時間後に自動消去（dismiss）
 *
 * @see buildTransportExceptions.ts — deep link 生成元
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TransportDirection } from './transportTypes';

export type TransportHighlight = {
  /** ハイライト対象の userId（null = ハイライトなし） */
  userId: string | null;
  /** 指定された方向（null = 指定なし） */
  direction: TransportDirection | null;
  /** ハイライトを即座に解除する */
  dismiss: () => void;
};

/** ハイライト自動消去までの時間 (ms) */
const HIGHLIGHT_DISMISS_MS = 5000;

/**
 * ExceptionCenter の deep link パラメータを読み取り、
 * transport ハイライト状態を管理する。
 */
export function useTransportHighlight(): TransportHighlight {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL からパラメータを読み取る（初回のみ有効化）
  const urlHighlight = useMemo(() => {
    const highlight = searchParams.get('highlight');
    const direction = searchParams.get('direction') as TransportDirection | null;
    return { highlight, direction };
  }, []); // intentional: 初回マウント時のみ読み取る

  const [activeHighlight, setActiveHighlight] = useState<string | null>(
    urlHighlight.highlight,
  );

  // URL パラメータを消す（リロードで再トリガーしないため）
  useEffect(() => {
    if (!urlHighlight.highlight) return;
    const params = new URLSearchParams(searchParams);
    params.delete('highlight');
    params.delete('direction');
    setSearchParams(params, { replace: true });
  }, []); // intentional: マウント時1回だけ

  // 自動消去タイマー
  useEffect(() => {
    if (!activeHighlight) return;
    const timer = setTimeout(() => {
      setActiveHighlight(null);
    }, HIGHLIGHT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [activeHighlight]);

  const dismiss = useCallback(() => {
    setActiveHighlight(null);
  }, []);

  return {
    userId: activeHighlight,
    direction: urlHighlight.direction,
    dismiss,
  };
}
