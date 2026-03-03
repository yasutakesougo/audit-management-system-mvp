// ---------------------------------------------------------------------------
// SupervisionCounterBadge — 観察義務カウンター表示
// Phase 2 の SupportCount ロジックを現場UIに統合
// ---------------------------------------------------------------------------
import VisibilityIcon from '@mui/icons-material/Visibility';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import {
    getSupervisionAlertLevel,
    getSupervisionCounter,
} from '../ibdStore';

type SupervisionCounterBadgeProps = {
  /** 対象利用者ID */
  userId: number;
  /** 詳細表示（バナー形式） */
  detailed?: boolean;
};

/**
 * 観察義務カウンターバッジ
 *
 * 記録画面やユーザー詳細に配置し、「2回に1回以上」の観察義務を
 * リアルタイムで可視化する。
 *
 * - OK (0): カウンター非表示
 * - Warning (1): 黄色チップ
 * - Overdue (≥2): 赤色バッジ + ガイダンスメッセージ
 */
const SupervisionCounterBadge: FC<SupervisionCounterBadgeProps> = ({
  userId,
  detailed = false,
}) => {
  const counter = getSupervisionCounter(userId);
  const alertLevel = getSupervisionAlertLevel(counter.supportCount);

  if (alertLevel === 'ok') {
    // 問題なし — コンパクトモードでは非表示
    if (!detailed) return null;
    return (
      <Chip
        icon={<VisibilityIcon />}
        label="観察済み"
        size="small"
        color="success"
        variant="outlined"
        data-testid="supervision-counter-ok"
      />
    );
  }

  if (!detailed) {
    // コンパクトモード: バッジ付きチップ
    return (
      <Badge
        badgeContent={counter.supportCount}
        color={alertLevel === 'overdue' ? 'error' : 'warning'}
        data-testid="supervision-counter-badge"
      >
        <Chip
          icon={<VisibilityIcon />}
          label={alertLevel === 'overdue' ? '要観察' : '観察推奨'}
          size="small"
          color={alertLevel === 'overdue' ? 'error' : 'warning'}
          variant={alertLevel === 'overdue' ? 'filled' : 'outlined'}
        />
      </Badge>
    );
  }

  // 詳細モード: アラートバナー
  return (
    <Alert
      severity={alertLevel === 'overdue' ? 'error' : 'warning'}
      icon={<VisibilityIcon />}
      data-testid="supervision-counter-alert"
    >
      <Stack spacing={0.5}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {alertLevel === 'overdue'
            ? '⚠️ 実践研修修了者の観察が必要です'
            : '次回支援前に観察を推奨します'}
        </Typography>
        <Typography variant="body2">
          現在 <strong>{counter.supportCount}回</strong> の支援が未観察です
          （基準: 2回に1回以上の観察が必要）
        </Typography>
        {counter.lastObservedAt && (
          <Typography variant="caption" color="text.secondary">
            最終観察日: {counter.lastObservedAt}
          </Typography>
        )}
      </Stack>
    </Alert>
  );
};

export default SupervisionCounterBadge;
