import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import type { SupportPlanDeployment } from '@/features/planDeployment/supportFlow';

type PlanSummaryCardProps = {
  deployment: SupportPlanDeployment | null;
  highlights?: {
    longTermGoal?: string;
    shortTermGoals?: string;
    monitoringPlan?: string;
    riskManagement?: string;
  };
};

const InfoRow: React.FC<{ label: string; value?: string; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => {
  if (!value?.trim()) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ color: 'text.secondary', mt: 0.2 }}>{icon}</Box>
      <Stack spacing={0.25} flex={1}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {value}
        </Typography>
      </Stack>
    </Stack>
  );
};

export const PlanSummaryCard: React.FC<PlanSummaryCardProps> = ({ deployment, highlights }) => {
  if (!deployment) {
    return (
      <Paper variant="outlined">
        <Stack spacing={1.5} sx={{ p: 2 }}>
          <Typography variant="h6">支援計画ハイライト</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            選択中の利用者に関連付けられた Mirai-Canvas の支援計画が見つかりませんでした。
            利用者ドラフトを展開するか、支援計画のデプロイメントを確認してください。
          </Typography>
        </Stack>
      </Paper>
    );
  }

  const { summary, activities, planName, version, deployedAt, references } = deployment;
  const { longTermGoal, shortTermGoals, monitoringPlan, riskManagement } = highlights ?? {};

  return (
    <Paper variant="outlined">
      <Stack spacing={2} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack spacing={0.25}>
            <Typography variant="h6">{planName}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              バージョン {version} ・ 展開日 {new Date(deployedAt).toLocaleString('ja-JP')}
            </Typography>
          </Stack>
          <Chip size="small" label={`支援ブロック ${activities.length}件`} />
        </Stack>

        {summary ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {summary}
          </Typography>
        ) : null}

        <Divider />

        <Stack spacing={1.5}>
          <InfoRow
            icon={<FlagRoundedIcon fontSize="small" />}
            label="長期目標"
            value={longTermGoal ?? references?.find((ref) => ref.label.includes('長期'))?.value}
          />
          <InfoRow
            icon={<FlagRoundedIcon fontSize="small" />}
            label="短期目標"
            value={shortTermGoals ?? references?.find((ref) => ref.label.includes('短期'))?.value}
          />
          <InfoRow
            icon={<ScheduleRoundedIcon fontSize="small" />}
            label="モニタリング"
            value={monitoringPlan}
          />
          <InfoRow
            icon={<LightbulbRoundedIcon fontSize="small" />}
            label="減算リスク対策"
            value={riskManagement}
          />
        </Stack>

        {references && references.length > 0 ? (
          <>
            <Divider />
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DescriptionRoundedIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2">Mirai-Canvas リンク</Typography>
              </Stack>
              <Stack spacing={0.75}>
                {references.map((ref) => (
                  <Stack key={`${ref.label}-${ref.value}`} spacing={0.25}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {ref.label}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {ref.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </>
        ) : null}
      </Stack>
    </Paper>
  );
};

PlanSummaryCard.displayName = 'PlanSummaryCard';
