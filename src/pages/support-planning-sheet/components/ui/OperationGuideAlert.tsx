import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type OperationGuideAlertProps = {
  isEditing: boolean;
  onJumpToMonitoringHistory: () => void;
  onJumpToPlanningTab: () => void;
  onStartEditing: () => void;
};

export function OperationGuideAlert({
  isEditing,
  onJumpToMonitoringHistory,
  onJumpToPlanningTab,
  onStartEditing,
}: OperationGuideAlertProps) {
  return (
    <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          操作ガイド
        </Typography>
        <Typography variant="caption" color="text.secondary">
          モニタリング履歴: 「モニタリング履歴 / 取込履歴」を確認してください。
        </Typography>
        <Typography variant="caption" color="text.secondary">
          履歴の絞り込み: 「すべて / モニタリング / アセスメント」を切り替えて確認できます。
        </Typography>
        <Typography variant="caption" color="text.secondary">
          支援手順の確認・更新: 「支援設計」タブで手順を確認し、編集後に保存してください。
        </Typography>
        <Typography variant="caption" color="text.secondary">
          編集更新の確認: 保存後に画面下部の更新日・更新者を確認してください。
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button size="small" onClick={onJumpToMonitoringHistory}>
            モニタリング履歴へ
          </Button>
          <Button size="small" onClick={onJumpToPlanningTab}>
            支援手順を確認
          </Button>
          <Button
            size="small"
            onClick={onStartEditing}
            disabled={isEditing}
          >
            編集を始める
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
