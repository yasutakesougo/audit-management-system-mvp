import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { Contract, MonthlySummary, UserMaster } from '../types';

interface HeaderInfoAreaProps {
  user: UserMaster;
  contract: Contract;
  summary: MonthlySummary;
}

export function HeaderInfoArea({ user, contract, summary }: HeaderInfoAreaProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              利用者情報
            </Typography>
            <Typography variant="body2">氏名: {user.name}</Typography>
            <Typography variant="body2">受給者証番号: {user.recipientId}</Typography>
            <Typography variant="body2">
              対象年月: {contract.serviceYearMonth} / 契約支給量: {contract.contractedVolume}日
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              月次集計
            </Typography>
            <Typography variant="body2">
              通所 {summary.presentDays} / 欠席 {summary.absentDays} / オンライン {summary.onlineDays}
            </Typography>
            <Typography variant="body2">
              送迎 往 {summary.transportOutbound} 回・復 {summary.transportInbound} 回
            </Typography>
            <Typography variant="body2">
              食事 {summary.mealAddonCount} 回・入浴 {summary.bathingAddonCount} 回
            </Typography>
            <Typography variant="body2">
              欠席時対応加算 {summary.absenceSupportCount} 回
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

