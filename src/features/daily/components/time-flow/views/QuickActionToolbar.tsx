// ---------------------------------------------------------------------------
// QuickActionToolbar — 現場ショートカットバー
// ---------------------------------------------------------------------------

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

interface QuickActionToolbarProps {
  pendingCount: number;
  onGenerateSample: () => void;
  onMarkComplete: () => void;
  isComplete: boolean;
}

const QuickActionToolbar: React.FC<QuickActionToolbarProps> = ({
  pendingCount,
  onGenerateSample,
  onMarkComplete,
  isComplete,
}) => {
  const helperText = isComplete
    ? '日次記録は完了済みです。必要に応じて記録を更新できます。'
    : pendingCount === 0
      ? '全ての時間帯が記録済みです。内容を確認して完了を確定しましょう。'
      : `未記録の時間帯が ${pendingCount} 件あります。現場状況に合わせて追加入力してください。`;

  return (
    <Card sx={{ mb: 3 }} elevation={2}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              現場ショートカット
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {helperText}
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
            <Button
              onClick={onGenerateSample}
              startIcon={<AutoAwesomeIcon />}
              variant="outlined"
              color="secondary"
              fullWidth
            >
              サンプルを再生成
            </Button>
            <Button
              onClick={onMarkComplete}
              startIcon={<CheckCircleIcon />}
              variant="contained"
              color="primary"
              disabled={isComplete || pendingCount > 0}
              fullWidth
            >
              日次記録を完了
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default QuickActionToolbar;
