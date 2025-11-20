// src/features/schedule/pages/OperationsDashboardPage.tsx
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';

import { TESTIDS, tid } from '@/testids';
import { DEFAULT_CONFLICT_RULES, detectScheduleConflicts } from '../conflictChecker';
import {
    buildDailyConflictSummary,
    buildStaffLoadSummary,
    buildVehicleUsageSummary,
} from '../opsSummary';
import type { Schedule } from '../types';

type OperationsDashboardPageProps = {
  /** 集計対象日。未指定なら Today() */
  date?: string;
  /** その日の全スケジュール（利用者・職員・車両・部屋 含む） */
  schedules: Schedule[];
};

const OperationsDashboardPage: React.FC<OperationsDashboardPageProps> = ({
  date,
  schedules,
}) => {
  const targetDate = useMemo(
    () => (date ? dayjs(date) : dayjs()),
    [date],
  );

  const conflicts = useMemo(
    () => detectScheduleConflicts(schedules, DEFAULT_CONFLICT_RULES),
    [schedules],
  );

  const conflictSummary = useMemo(
    () => buildDailyConflictSummary(targetDate.format('YYYY-MM-DD'), conflicts, schedules),
    [targetDate, conflicts, schedules],
  );

  const staffLoad = useMemo(
    () => buildStaffLoadSummary(targetDate.format('YYYY-MM-DD'), schedules),
    [targetDate, schedules],
  );

  const vehicleUsage = useMemo(
    () => buildVehicleUsageSummary(targetDate.format('YYYY-MM-DD'), schedules),
    [targetDate, schedules],
  );

  return (
    <Box
      {...tid(TESTIDS['operations-dashboard-page'])}
      sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Typography variant="h5" gutterBottom>
        オペレーション・ダッシュボード（{targetDate.format('YYYY/MM/DD')}）
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <SafetyHudCard conflictSummary={conflictSummary} />
        <StaffLoadCard staffLoad={staffLoad} />
      </Stack>

      <VehicleUsageCard vehicleUsage={vehicleUsage} />
    </Box>
  );
};

export default OperationsDashboardPage;

// ---------- Safety HUD ----------

type SafetyHudCardProps = {
  conflictSummary: ReturnType<typeof buildDailyConflictSummary>;
};

const SafetyHudCard: React.FC<SafetyHudCardProps> = ({ conflictSummary }) => {
  const { totalConflicts, byKind } = conflictSummary;

  // "予定の重なり 0件なら安全度100%" のイメージバー（まずは適当な線形）
  const safetyScore = totalConflicts === 0 ? 100 : Math.max(0, 100 - totalConflicts * 10);

  return (
    <Card
      {...tid(TESTIDS['operations-safety-hud'])}
      sx={{ flex: 1, minWidth: 0 }}
    >
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          今日の安全インジケーター
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          ※ スケジュール上の"重なり"や"配置の無理"をもとに自動算出しています
        </Typography>

        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={safetyScore}
            />
            <Typography
              {...tid(TESTIDS['operations-safety-hud-total'])}
              variant="body2"
              sx={{ mt: 0.5 }}
            >
              予定の重なり {totalConflicts} 件（安全度 {safetyScore}%）
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              （目安：0件=とても安定 ／ 1〜3件=注意 ／ 4件以上=要確認）
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack
          {...tid(TESTIDS['operations-safety-hud-kind-list'])}
          direction="row"
          flexWrap="wrap"
          spacing={1}
          rowGap={1}
        >
          {Object.entries(byKind).map(([kind, count]) => (
            <Chip
              key={kind}
              size="small"
              label={`${kind}: ${count}件`}
              color={count > 0 ? 'warning' : 'default'}
            />
          ))}
          {Object.keys(byKind).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              種別ごとの予定の重なりはありません。
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

// ---------- Staff load mini panel ----------

type StaffLoadCardProps = {
  staffLoad: ReturnType<typeof buildStaffLoadSummary>;
};

const StaffLoadCard: React.FC<StaffLoadCardProps> = ({ staffLoad }) => {
  return (
    <Card
      {...tid(TESTIDS['operations-staff-load-panel'])}
      sx={{ flex: 1, minWidth: 0 }}
    >
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          職員負荷ミニパネル（担当件数）
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          ※ 1日あたり 5件以上担当している職員は<strong>ハイライト</strong>されます
        </Typography>

        {staffLoad.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            本日の担当スケジュールはまだありません。
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {staffLoad.map((item) => (
              <Stack
                key={item.staffId}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                {...tid(TESTIDS['operations-staff-load-row'])}
              >
                <Typography variant="body2">
                  {item.staffId}
                </Typography>
                <Chip
                  size="small"
                  label={`${item.scheduleCount} 件`}
                  color={item.scheduleCount >= 5 ? 'warning' : 'default'}
                />
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

// ---------- Vehicle usage mini panel ----------

type VehicleUsageCardProps = {
  vehicleUsage: ReturnType<typeof buildVehicleUsageSummary>;
};

const VehicleUsageCard: React.FC<VehicleUsageCardProps> = ({ vehicleUsage }) => {
  const totalTrips = vehicleUsage.reduce((sum, v) => sum + v.tripCount, 0);

  return (
    <Card
      {...tid(TESTIDS['operations-vehicle-panel'])}
      sx={{ mt: 2 }}
    >
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          車両稼働メーター（本数ベース）
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          本日の送迎便数 合計：{totalTrips} 便
        </Typography>

        {vehicleUsage.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            本日の車両スケジュールはまだありません。
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {vehicleUsage.map((v) => (
              <Stack
                key={v.vehicleId}
                direction="row"
                alignItems="center"
                spacing={1}
                {...tid(TESTIDS['operations-vehicle-row'])}
              >
                <Box sx={{ minWidth: 80 }}>
                  <Typography variant="body2">{v.vehicleId}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, v.tripCount * 15)} // とりあえず "便数×15%" くらいで視覚化
                  />
                </Box>
                <Typography variant="caption" sx={{ minWidth: 60, textAlign: 'right' }}>
                  {v.tripCount} 便
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};