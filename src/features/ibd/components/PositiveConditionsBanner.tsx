// ---------------------------------------------------------------------------
// PositiveConditionsBanner — 「良い状態の条件」強調表示バナー
// 各場面・手順書の冒頭に配置し、予防的支援の意識を定着させる
// ---------------------------------------------------------------------------
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type { FC } from 'react';

type PositiveConditionsBannerProps = {
  /** 良い状態の条件リスト */
  conditions: string[];
  /** 場面名（省略可） */
  sceneName?: string;
  /** コンパクト表示 */
  compact?: boolean;
};

/**
 * 「良い状態の条件」強調バナー
 *
 * 支援手順書の各場面冒頭に配置し、本人が安定して過ごせる条件を
 * 最初に意識させることで、予防的支援アプローチを促進する。
 *
 * @example
 * ```tsx
 * <PositiveConditionsBanner
 *   conditions={['静かな環境', '視覚的スケジュールの提示', '馴染みのスタッフ']}
 *   sceneName="来所時"
 * />
 * ```
 */
const PositiveConditionsBanner: FC<PositiveConditionsBannerProps> = ({
  conditions,
  sceneName,
  compact = false,
}) => {
  if (conditions.length === 0) return null;

  const title = sceneName
    ? `${sceneName}：安定のための条件`
    : '安定のための条件（良い状態の条件）';

  if (compact) {
    return (
      <Alert
        severity="success"
        icon={<CheckCircleOutlineIcon />}
        sx={{ borderRadius: 2 }}
        data-testid="positive-conditions-banner"
      >
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {conditions.map((c) => (
            <Chip key={c} label={c} size="small" color="success" variant="outlined" />
          ))}
        </Stack>
      </Alert>
    );
  }

  return (
    <Alert
      severity="success"
      icon={<CheckCircleOutlineIcon />}
      sx={{
        borderRadius: 2,
        '& .MuiAlert-message': { width: '100%' },
      }}
      data-testid="positive-conditions-banner"
    >
      <AlertTitle sx={{ fontWeight: 700 }}>{title}</AlertTitle>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
        {conditions.map((condition) => (
          <Chip
            key={condition}
            label={condition}
            size="small"
            color="success"
            variant="filled"
            icon={<CheckCircleOutlineIcon />}
            sx={{ fontWeight: 500 }}
          />
        ))}
      </Stack>
    </Alert>
  );
};

export default PositiveConditionsBanner;
