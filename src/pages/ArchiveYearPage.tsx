import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import React, { useMemo } from 'react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import {
  ARCHIVE_RETENTION_YEARS,
  formatArchiveLabel,
  getArchiveYears,
  isArchiveYearWithinRetention,
} from '@/features/archive/archiveUtils';

type ArchiveCollection = {
  key: string;
  title: string;
  description: string;
  scope: string;
  to: string;
  icon: React.ElementType;
};

const buildCollections = (year: number): ArchiveCollection[] => [
  {
    key: 'daily',
    title: '活動日誌',
    description: `${year}年度の日次活動記録・スタッフ所見・特記事項をまとめて保管しています。`,
    scope: '日次記録・活動レポート',
    to: `/records?year=${year}&type=daily`,
    icon: AssignmentTurnedInRoundedIcon,
  },
  {
    key: 'support-record',
    title: '支援手順兼記録',
    description: `${year}年度の支援手順書および実施記録を年度単位でアーカイブしています。`,
    scope: '支援手順・個別対応ログ',
    to: `/records/support-procedures?year=${year}`,
    icon: HealingRoundedIcon,
  },
  {
    key: 'attendance',
    title: '通所実績',
    description: `${year}年度の出席・欠席状況および通所統計を年度単位で保存しています。`,
    scope: '出欠・通所統計',
    to: `/daily/attendance?year=${year}`,
    icon: EventAvailableRoundedIcon,
  },
  {
    key: 'audit',
    title: '監査ログ',
    description: `${year}年度の監査対応記録、指摘事項への是正履歴、証跡資料のアーカイブです。`,
    scope: '監査・是正履歴',
    to: `/audit?year=${year}`,
    icon: AssessmentRoundedIcon,
  },
  {
    key: 'compliance',
    title: 'コンプライアンス報告',
    description: `${year}年度の事故・ヒヤリハット・コンプラ報告フォームを年度ごとに整理しています。`,
    scope: 'コンプラ・事故報告',
    to: `/compliance?year=${year}`,
    icon: ChecklistRoundedIcon,
  },
  {
    key: 'support-plan',
    title: '個別支援計画',
    description: `${year}年度に策定・更新した個別支援計画書と関連資料のアーカイブです。`,
    scope: '支援計画書・同意書',
    to: `/guide/support-plan?year=${year}`,
    icon: DescriptionRoundedIcon,
  },
  {
    key: 'staff-meeting',
    title: '職員会議議事録',
    description: `${year}年度の定例職員会議・連絡会の議事録、決定事項、フォローアップ記録を保存しています。`,
    scope: '職員会議・決定事項',
    to: `/staff/meetings?year=${year}`,
    icon: PeopleAltRoundedIcon,
  },
];

const ArchiveYearPage: React.FC = () => {
  const { year } = useParams<{ year?: string }>();
  const archiveYears = useMemo(() => getArchiveYears(), []);
  const latestYear = archiveYears[0];

  if (!year) {
    return <Navigate to={`/archives/${latestYear}`} replace />;
  }

  const parsedYear = Number(year);
  if (!Number.isInteger(parsedYear)) {
    return <Navigate to={`/archives/${latestYear}`} replace />;
  }

  if (!isArchiveYearWithinRetention(parsedYear)) {
    return <Navigate to={`/archives/${latestYear}`} replace />;
  }

  const label = formatArchiveLabel(parsedYear);
  const collections = useMemo(() => buildCollections(parsedYear), [parsedYear]);
  const retentionDeadline = parsedYear + ARCHIVE_RETENTION_YEARS;

  return (
    <Box>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ArchiveRoundedIcon color="primary" />
            <Typography variant="h4" component="h1">
              {label}
            </Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary">
            磯子区障害者地域活動ホームでは、個人情報保護規程に基づき記録を年度ごとに整理し、
            {ARCHIVE_RETENTION_YEARS}年間保管後に適切な方法で廃棄しています。
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={`保管期限: ${retentionDeadline}年度末まで`} size="small" color="primary" />
            <Chip label="保存ルール: 5年間" size="small" variant="outlined" />
          </Stack>
        </Stack>

        <Alert severity="info">
          過去{ARCHIVE_RETENTION_YEARS}年度分のみ参照できます。古い年度の記録は機密破棄済みです。必要な場合は所管部署までお問い合わせください。
        </Alert>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          aria-label="年度切り替え"
        >
          <Typography variant="subtitle2" sx={{ mr: 1 }}>
            年度を選択:
          </Typography>
          {archiveYears.map((archiveYear) => {
            const active = archiveYear === parsedYear;
            return (
              <Button
                key={archiveYear}
                component={RouterLink}
                to={`/archives/${archiveYear}`}
                variant={active ? 'contained' : 'outlined'}
                color={active ? 'primary' : 'inherit'}
                size="small"
              >
                {archiveYear}年度
              </Button>
            );
          })}
        </Stack>

        <Divider />

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          {collections.map(({ key, title, description, scope, to, icon: IconComponent }) => (
            <Card
              key={key}
              variant="outlined"
              sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconComponent color="primary" />
                    <Typography variant="h6">{title}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                  <Chip label={scope} size="small" color="secondary" variant="outlined" />
                </Stack>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  component={RouterLink}
                  to={to}
                  variant="contained"
                  color="primary"
                  size="small"
                >
                  記録を表示
                </Button>
                <Button
                  component={RouterLink}
                  to={`${to}&export=1`}
                  variant="outlined"
                  size="small"
                >
                  年度データを出力
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      </Stack>
    </Box>
  );
};

export default ArchiveYearPage;
