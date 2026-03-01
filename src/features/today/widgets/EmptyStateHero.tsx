/**
 * EmptyStateHero — Hero完了分岐のサブコンポーネント
 *
 * HeroUnfinishedBanner の isComplete === true 時に表示。
 * EmptyStateBlock の hero variant をラップし、
 * 既存 today-hero-banner の testid は親が維持している。
 */
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import React from 'react';
import { EmptyStateBlock } from './EmptyStateBlock';

export type EmptyStateHeroProps = {
  /** 「記録メニュー」等への導線 */
  onClickMenu?: () => void;
};

export const EmptyStateHero: React.FC<EmptyStateHeroProps> = ({
  onClickMenu,
}) => {
  return (
    <EmptyStateBlock
      icon={<CheckCircleOutlineIcon />}
      title="本日の対応は完了しました"
      description="お疲れさまでした。次の準備に進めます。"
      primaryAction={
        onClickMenu
          ? {
              label: '📋 記録メニューを開く',
              onClick: onClickMenu,
              testId: 'today-empty-hero-cta',
            }
          : undefined
      }
      testId="today-empty-hero"
      variant="hero"
    />
  );
};
