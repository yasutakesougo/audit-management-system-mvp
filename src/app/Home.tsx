import { useFeatureFlags } from '@/config/featureFlags';
import { useDashboardPath } from '@/features/dashboard/dashboardRouting';
import MobileAgendaView from '@/features/schedules/components/MobileAgendaView';
import NextActionCard from '@/features/schedules/components/NextActionCard';
import { useSchedulesToday } from '@/features/schedules/hooks/useSchedulesToday';
import { isDemoModeEnabled } from '@/lib/env';
import { TESTIDS, type TestId } from '@/testids';
import UnsynedAuditBadge from '@/ui/components/UnsynedAuditBadge';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PhonelinkRoundedIcon from '@mui/icons-material/PhonelinkRounded';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import type { Theme } from '@mui/material/styles';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

type TileTone = 'primary' | 'success' | 'info' | 'warning' | 'secondary' | 'neutral';

type Tile = {
  to: string;
  label: string;
  caption: string;
  Icon: typeof PeopleAltRoundedIcon;
  tone: TileTone;
  ariaLabel?: string;
  testId?: TestId;
};

const baseTiles = (
  dashboardPath: string,
): Tile[] => [
  {
    to: '/users',
    label: '利用者マスタ',
    caption: '利用者情報を閲覧・管理',
    Icon: PeopleAltRoundedIcon,
    tone: 'primary',
  },
  {
    to: '/staff',
    label: '職員マスタ',
    caption: '職員情報と勤務パターンを管理',
    Icon: PeopleAltRoundedIcon,
    tone: 'success',
  },
  {
    to: dashboardPath,
    label: 'オペレーションハブ',
    caption: '施設全体の運営状況を俯瞰',
    Icon: SpaceDashboardRoundedIcon,
    tone: 'info',
  },
  {
    to: '/schedules/week',
    label: 'マスタースケジュール',
    caption: '事業所スケジュールをチェック',
    Icon: EventAvailableRoundedIcon,
    tone: 'secondary',
    testId: TESTIDS['home-tile-schedule'],
  },
  {
    to: '/mobile',
    label: 'モバイル予定ビュー',
    caption: 'スマホ向けの簡易ビュー',
    Icon: PhonelinkRoundedIcon,
    tone: 'warning',
  },
  {
    to: '/records',
    label: '日次記録',
    caption: '今日の記録入力を開始',
    Icon: AssignmentTurnedInRoundedIcon,
    tone: 'info',
  },
  {
    to: '/checklist',
    label: '自己点検チェックリスト',
    caption: '監査前チェックを実施',
    Icon: ChecklistRoundedIcon,
    tone: 'neutral',
  },
];

const tabletDemoTile: Tile = {
  to: '/tablet-demo',
  label: 'タブレット デモ',
  caption: 'ログイン→ホーム→記録入力の流れを体験',
  Icon: PhonelinkRoundedIcon,
  tone: 'success',
  ariaLabel: 'タブレットデモへ移動',
};

const codeSx = {
  px: 1,
  py: 0.25,
  borderRadius: 1,
  bgcolor: 'action.hover',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
};

const demoBullets = [
  'データはメモリに保持され、ブラウザをリロードすると初期サンプルに戻ります。',
  '.env.demo.local のフラグを更新すると、即座に MSAL あり/なしを切り替えできます。',
  <>
    本番接続を試す際は <Box component="code" sx={codeSx}>npm run dev</Box> を使い、SharePoint/Entra の設定を有効化してください。
  </>,
];

const productionBullets = [
  '各カードは SharePoint と連携するため、Entra ID へのサインインが必要です。',
  <>
    サンプルデータで試す場合は <Box component="code" sx={codeSx}>VITE_DEMO_MODE=1</Box> を設定し、開発サーバーを再起動してください。
  </>,
  '本番テナントで利用する際は、SharePoint API とデリゲート権限に管理者承認を付与してください。',
];

const toneStyles = (tone: TileTone, theme: Theme) => {
  const { palette } = theme;
  const base =
    tone === 'neutral'
      ? { main: palette.text.primary }
      : palette[tone];

  const backgroundStrength = palette.mode === 'dark' ? 0.3 : 0.12;
  const borderStrength = palette.mode === 'dark' ? 0.5 : 0.24;

  return {
    iconColor: base.main,
    iconBg: alpha(base.main, backgroundStrength),
    border: alpha(base.main, borderStrength),
  };
};

export default function Home() {
  const theme = useTheme();
  const demoModeEnabled = isDemoModeEnabled();
  const { schedules: schedulesEnabled } = useFeatureFlags();
  const dashboardPath = useDashboardPath();
  const bullets = demoModeEnabled ? demoBullets : productionBullets;
  const filteredTiles = baseTiles(dashboardPath).filter(
    (tile) => schedulesEnabled || tile.to !== '/schedules/week',
  );
  const activeTiles = demoModeEnabled ? [tabletDemoTile, ...filteredTiles] : filteredTiles;
  const {
    data: todaySchedules,
    source: scheduleSource,
    fallbackError: scheduleFallbackError,
  } = useSchedulesToday(5);

  const dataSourceChip: { label: string; color: 'success' | 'info' } | null =
    schedulesEnabled && scheduleSource
      ? {
          label: scheduleSource === 'sharepoint' ? 'SharePoint' : 'Demo',
          color: scheduleSource === 'sharepoint' ? 'success' : 'info',
        }
      : null;

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={4}>
        <Stack component="section" spacing={2}>
          <div>
            <Typography variant="h3" component="h1" fontWeight={700} gutterBottom>
              {demoModeEnabled ? 'Audit Management MVP – Demo' : 'Audit Management MVP'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              SharePoint 接続や MSAL 認証を待たずに、利用者マスタと日次記録フローをすぐに体験できます。
            </Typography>
          </div>
          <Stack direction="row" flexWrap="wrap" spacing={1.5} alignItems="center">
            <Chip
              label={demoModeEnabled ? 'デモモードが有効です' : '本番モード（MSAL 認証あり）'}
              color={demoModeEnabled ? 'success' : 'warning'}
              icon={<FiberManualRecordRoundedIcon fontSize="small" />}
              variant={demoModeEnabled ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600 }}
              data-testid="home-mode-chip"
            />
            {dataSourceChip && (
              <Chip
                size="small"
                color={dataSourceChip.color}
                variant="outlined"
                label={`データソース: ${dataSourceChip.label}`}
                data-testid="home-data-source-chip"
                sx={{ fontWeight: 600 }}
              />
            )}
            <UnsynedAuditBadge size="small" data-testid="home-unsync-badge" />
            {!demoModeEnabled && (
              <Typography variant="body2" color="text.secondary">
                <Box component="code" sx={codeSx}>
                  VITE_DEMO_MODE=1
                </Box>{' '}
                に切り替えるとサンプルデータで試せます。
              </Typography>
            )}
          </Stack>
            {schedulesEnabled && scheduleFallbackError ? (
            <Paper
              role="alert"
              aria-live="polite"
              variant="outlined"
              data-testid="home-demo-fallback-banner"
              sx={{
                px: 2,
                py: 1,
                borderColor: 'error.main',
                color: 'error.main',
                bgcolor: (paperTheme) =>
                  paperTheme.palette.mode === 'dark'
                    ? alpha(paperTheme.palette.error.main, 0.12)
                    : alpha(paperTheme.palette.error.main, 0.08),
              }}
            >
              SharePoint に接続できなかったため、サンプルデータを表示しています。
            </Paper>
          ) : null}
        </Stack>

        {/* 次のアクションカード - スマートフォン最適化 */}
        {schedulesEnabled && (
          <Box
            component="section"
            aria-label="次のアクション"
            sx={{ display: { xs: 'block', md: 'none' } }} // スマートフォンのみ表示
          >
            <NextActionCard
              schedules={todaySchedules.map(mini => ({
                id: mini.id.toString(),
                title: mini.title,
                start: mini.startText,
                end: mini.startText, // TODO: MiniSchedule に endText を追加するか、NextActionCard で end を Optional 対応する
                status: mini.status || '承認済み',
              }))}
            />
          </Box>
        )}

        <Box
          component="section"
          aria-label="主要機能のタイル一覧"
          role="list"
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: 'repeat(1, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {activeTiles.map(({ to, label, caption, Icon, tone, ariaLabel, testId }) => {
            const palette = toneStyles(tone, theme);
            const fallbackTestId = `home-tile-${to
              .replace(/^\//, '')
              .replace(/\//g, '-')}`;
            return (
              <Card
                key={to}
                role="listitem"
                variant="outlined"
                data-testid={testId ?? fallbackTestId}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: palette.border,
                }}
              >
                <CardActionArea
                  component={RouterLink}
                  to={to}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    textAlign: 'left',
                    '&:hover .tile-icon': {
                      transform: 'scale(1.05)',
                    },
                    '&.Mui-focusVisible': (focusTheme) => ({
                      outline: `2px solid ${focusTheme.palette.primary.main}`,
                      outlineOffset: 2,
                      borderRadius: focusTheme.shape.borderRadius,
                    }),
                  }}
                  aria-label={ariaLabel ?? `${label}へ移動`}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        className="tile-icon"
                        aria-hidden="true"
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: palette.iconColor,
                          bgcolor: palette.iconBg,
                          transition: theme.transitions.create('transform'),
                        }}
                      >
                        <Icon fontSize="medium" />
                      </Box>
                      <Stack spacing={0.5}>
                        <Typography variant="h6" component="h2" fontWeight={600}>
                          {label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {caption}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ pt: 0, pb: 2, px: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="primary" fontWeight={600}>
                        詳細を開く
                      </Typography>
                      <ArrowForwardRoundedIcon fontSize="small" color="primary" />
                    </Stack>
                  </CardActions>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>

        {/* 今日の予定セクション（タブレット・デスクトップでの詳細表示） */}
        {schedulesEnabled && (
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Paper component="section" variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
              <MobileAgendaView maxItems={8} />
            </Paper>
          </Box>
        )}

        <Paper component="section" variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              {demoModeEnabled ? 'デモモードについて' : 'MSAL サインインについて'}
            </Typography>
            <Divider flexItem sx={{ borderStyle: 'dashed' }} />
            <List dense disablePadding>
              {bullets.map((content, index) => (
                <ListItem key={index} disableGutters sx={{ alignItems: 'flex-start' }}>
                  <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>
                    <FiberManualRecordRoundedIcon fontSize="inherit" sx={{ fontSize: 10 }} />
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                      component: 'span',
                    }}
                    primary={content}
                  />
                </ListItem>
              ))}
            </List>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}