/**
 * FadeSlide — 軽量なフェード + スライドトランジション
 *
 * MUI の Fade/Slide コンポーネントは ref forwarding が必要で
 * children の型制約が厳しいため、純粋な CSS @keyframes で実装。
 *
 * 特徴:
 * - ゼロ依存（framer-motion 不要）
 * - key 変更時に自動でアニメーション発火
 * - direction で上下左右指定可能
 * - `prefers-reduced-motion` を尊重
 */

import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

// ── Props ──

export interface FadeSlideProps {
  /** アニメーションをトリガーする一意のキー */
  transitionKey: string | number;
  /** アニメーション方向 */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** アニメーション時間(ms) */
  duration?: number;
  /** 遅延(ms) */
  delay?: number;
  /** 追加の sx */
  sx?: SxProps<Theme>;
  /** コンテンツ */
  children: React.ReactNode;
}

// ── 方向ごとの初期位置 ──

const SLIDE_OFFSET: Record<NonNullable<FadeSlideProps['direction']>, string> = {
  up:    'translateY(12px)',
  down:  'translateY(-12px)',
  left:  'translateX(16px)',
  right: 'translateX(-16px)',
};

// ── コンポーネント ──

export const FadeSlide: React.FC<FadeSlideProps> = ({
  transitionKey,
  direction = 'up',
  duration = 280,
  delay = 0,
  sx,
  children,
}) => {
  const animName = `fadeSlide-${direction}`;
  const offset = SLIDE_OFFSET[direction];

  return (
    <Box
      key={transitionKey}
      sx={{
        [`@keyframes ${animName}`]: {
          '0%': {
            opacity: 0,
            transform: offset,
          },
          '100%': {
            opacity: 1,
            transform: 'translate(0, 0)',
          },
        },
        animation: `${animName} ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms both`,
        // アクセシビリティ: 動きの減速を好むユーザーへの配慮
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          opacity: 1,
          transform: 'none',
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

/**
 * FadeIn — シンプルなフェードイン（移動なし）
 *
 * セクションの初期表示やカードの出現に使用。
 */
export const FadeIn: React.FC<{
  transitionKey: string | number;
  duration?: number;
  delay?: number;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}> = ({ transitionKey, duration = 220, delay = 0, sx, children }) => (
  <Box
    key={transitionKey}
    sx={{
      '@keyframes fadeIn': {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      },
      animation: `fadeIn ${duration}ms ease-out ${delay}ms both`,
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
        opacity: 1,
      },
      ...sx,
    }}
  >
    {children}
  </Box>
);
