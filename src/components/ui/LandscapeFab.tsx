import Fab from '@mui/material/Fab';
import { ReactNode } from 'react';
import { useLandscapeTablet } from '../../hooks/useLandscapeTablet';

interface LandscapeFabProps {
  icon: ReactNode;
  ariaLabel: string;
  onClick: () => void;
  testId?: string;
}

/**
 * LandscapeFab - 横長タブレット対応のFABコンポーネント
 *
 * 横長タブレット（md〜lg未満）では：
 * - サイズを large に拡大
 * - 下部ナビゲーション回避用に上位置配置
 * - color を success に統一
 *
 * 位置：
 * - 標準（モバイル）: bottom 16px, right 16px  
 * - 横長タブ: bottom calc(16px + var(--bottom-nav-height, 88px)) で下部UI干渉回避
 *   → --bottom-nav-height は AppShell で定義可能（デフォルト 88px）
 *
 * モバイル/デスクトップでは標準サイズ
 */
export const LandscapeFab = ({
  icon,
  ariaLabel,
  onClick,
  testId
}: LandscapeFabProps) => {
  const isLandscapeTablet = useLandscapeTablet();

  return (
    <Fab
      color="success"
      aria-label={ariaLabel}
      size={isLandscapeTablet ? 'large' : 'medium'}
      onClick={onClick}
      sx={{
        position: 'fixed',
        bottom: isLandscapeTablet 
          ? 'calc(16px + var(--bottom-nav-height, 88px))' 
          : 16,
        right: isLandscapeTablet ? 24 : 16
      }}
      data-testid={testId}
    >
      {icon}
    </Fab>
  );
};
