/**
 * useKeyboardAwareScroll
 *
 * タブレットの仮想キーボードが表示された際に、
 * フォーカスされた入力欄を可視領域に自動スクロールする。
 *
 * - visualViewport API でキーボード高さを検知
 * - focusin イベントで入力欄の位置を自動調整
 * - CSS custom property `--keyboard-inset` でレイアウト調整用の値を提供
 *
 * @param enabled - キオスクモード等で有効化
 */
import { useEffect } from 'react';

export function useKeyboardAwareScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const vv = window.visualViewport;
    if (!vv) return;

    // ── キーボード高さを CSS custom property として公開 ──
    const updateKeyboardInset = () => {
      // visualViewport.height はキーボードを除いた可視領域の高さ
      const keyboardHeight = window.innerHeight - vv.height;
      const inset = Math.max(0, keyboardHeight);
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${inset}px`,
      );
    };

    // ── フォーカスされた入力欄を可視領域にスクロール ──
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const tag = target.tagName.toLowerCase();
      const isInput =
        tag === 'input' || tag === 'textarea' || target.isContentEditable;
      if (!isInput) return;

      // キーボードのアニメーション完了を待つ（iOS: ~300ms）
      setTimeout(() => {
        if (!vv) return;

        const rect = target.getBoundingClientRect();
        const visibleBottom = vv.height;

        // 入力欄の下端が可視領域の下端の80%より下にある場合にスクロール
        // (80%にすることで、入力欄の下に少し余白を確保)
        const threshold = visibleBottom * 0.8;

        if (rect.bottom > threshold) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 350);
    };

    vv.addEventListener('resize', updateKeyboardInset);
    document.addEventListener('focusin', handleFocusIn);

    // 初期値
    updateKeyboardInset();

    return () => {
      vv.removeEventListener('resize', updateKeyboardInset);
      document.removeEventListener('focusin', handleFocusIn);
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, [enabled]);
}
