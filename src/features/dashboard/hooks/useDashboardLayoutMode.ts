/**
 * useDashboardLayoutMode — ダッシュボードのレイアウトモード判定フック
 *
 * URL クエリパラメータとウィンドウ幅から、3つのレイアウトモードを判定する。
 * IIFE によるレイアウト分岐を宣言的なフック呼び出しに置き換える。
 *
 * モード:
 *   - 'zeroScroll': ゼロスクロール（デフォルト有効、?zeroscroll=0 で無効化）
 *   - 'tabletLandscape': タブレット横置き / 広幅 PC
 *   - 'standard': 通常の縦積みレイアウト
 */

import { useLocation } from 'react-router-dom';

export type DashboardLayoutMode = 'zeroScroll' | 'tabletLandscape' | 'standard';

export function useDashboardLayoutMode(): DashboardLayoutMode {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const tabletParam = searchParams.get('tablet');
  const zeroScrollParam = searchParams.get('zeroscroll');

  // Zero-Scroll をデフォルトで有効化（?zeroscroll=0 で無効化可能）
  const forceZeroScroll = zeroScrollParam !== '0';
  if (forceZeroScroll) {
    return 'zeroScroll';
  }

  // タブレット横置き判定
  const forceTablet = tabletParam === '1';
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const meetsWidth = windowWidth >= 1024;
  const isTabletLandscape = forceTablet || meetsWidth;

  if (isTabletLandscape) {
    return 'tabletLandscape';
  }

  return 'standard';
}
