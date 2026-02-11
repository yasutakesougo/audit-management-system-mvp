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
 * - 位置を 24px（標準は16px）
 * - color を success に統一
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
        bottom: isLandscapeTablet ? 24 : 16,
        right: isLandscapeTablet ? 24 : 16
      }}
      data-testid={testId}
    >
      {icon}
    </Fab>
  );
};
