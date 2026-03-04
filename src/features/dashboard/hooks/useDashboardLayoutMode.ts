/**
 * useDashboardLayoutMode — ダッシュボードのレイアウトモード判定フック
 *
 * URL クエリパラメータとウィンドウ幅から、4つのレイアウトモードを判定する。
 * IIFE によるレイアウト分岐を宣言的なフック呼び出しに置き換える。
 *
 * モード:
 *   - 'bentoGrid':        🍱 Bento Grid（?bento=1 で有効化）
 *   - 'zeroScroll':       ゼロスクロール（デフォルト有効、?zeroscroll=0 で無効化）
 *   - 'tabletLandscape':  タブレット横置き / 広幅 PC
 *   - 'standard':         通常の縦積みレイアウト
 */

import { useLocation } from 'react-router-dom';

export type DashboardLayoutMode = 'bentoGrid' | 'zeroScroll' | 'tabletLandscape' | 'standard';

export function useDashboardLayoutMode(): DashboardLayoutMode {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const bentoParam = searchParams.get('bento');
  const tabletParam = searchParams.get('tablet');
  const zeroScrollParam = searchParams.get('zeroscroll');

  // 🍱 Bento Grid（?bento=1 で明示的に有効化）
  if (bentoParam === '1') {
    return 'bentoGrid';
  }

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
