import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
// MUI Components
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// MUI Icons
import { useFeatureFlags } from '@/config/featureFlags';
import SharePointListDebug from '@/debug/SharePointListDebug';
import { useSchedulesToday } from '@/features/schedule/useSchedulesToday';
import { useUsersStore } from '@/features/users/store';
import { getAppConfig, isDemoModeEnabled } from '@/lib/env';
import { useStaff } from '@/stores/useStaff';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PhonelinkRoundedIcon from '@mui/icons-material/PhonelinkRounded';

type SectionCardProps = {
  title: string;
  to?: string;
  children: ReactNode;
};

const SectionCard = ({ title, to, children }: SectionCardProps) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" component="h2" fontWeight={600}>
          {title}
        </Typography>
        {to && (
          <Button
            component={Link}
            to={to}
            size="small"
            variant="outlined"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            すべて見る
          </Button>
        )}
      </Box>
      {children}
    </CardContent>
  </Card>
);

export default function Home() {
  const demoModeEnabled = isDemoModeEnabled();
  const { schedules: schedulesEnabled } = useFeatureFlags();
  const { data: users, status: usersStatus, error: usersError } = useUsersStore();

  // デバッグ情報をコンソールに出力
  console.log('[Home] Component rendered!');
  console.log('[Home] Demo mode enabled:', demoModeEnabled);
  console.log('[Home] Users debug:', {
    usersStatus,
    usersCount: users?.length,
    usersError: usersError ? String(usersError) : null,
    users: users?.slice(0, 3) // 最初の3件のみ表示
  });
  console.log('[Home] useUsersStore result:', { users, usersStatus, usersError });
  const { data: staff } = useStaff();
  const {
    data: schedules,
    loading: schedulesLoading,
    error: schedulesError,
    dateISO,
    source: schedulesSource,
    fallbackKind: schedulesFallbackKind,
    fallbackError: schedulesFallbackError,
  } = useSchedulesToday(5);

  const sourceChipLabel = schedulesSource === 'sharepoint' ? 'SharePoint' : 'Demo';
  const sourceChipColor: 'success' | 'error' | 'info' = schedulesSource === 'sharepoint'
    ? 'success'
    : schedulesFallbackError
      ? 'error'
      : 'info';
  const fallbackKindLabel = schedulesFallbackKind
    ? {
        auth: '認証・同意が必要',
        network: 'ネットワーク障害',
        schema: 'スキーマ不整合',
        unknown: '不明なエラー',
      }[schedulesFallbackKind]
    : null;

  const tiles = [
    { to: '/users', label: '利用者マスタ', caption: '利用者情報を閲覧・管理', Icon: PeopleAltRoundedIcon, accent: 'text-blue-600 bg-blue-100', border: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50' },
  { to: '/dashboard', label: 'オペレーションハブ', caption: '施設全体の運営状況を俯瞰', Icon: DashboardRoundedIcon, accent: 'text-green-600 bg-green-100', border: 'border-green-200 hover:border-green-300 hover:bg-green-50' },
    { to: '/schedule', label: 'スケジュール', caption: '今日の予定をチェック', Icon: EventAvailableRoundedIcon, accent: 'text-purple-600 bg-purple-100', border: 'border-purple-200 hover:border-purple-300 hover:bg-purple-50' },
    { to: '/tablet-demo', label: 'モバイル予定ビュー', caption: 'スマホ向けの簡易ビュー', Icon: PhonelinkRoundedIcon, accent: 'text-amber-600 bg-amber-100', border: 'border-amber-200 hover:border-amber-300 hover:bg-amber-50' },
    { to: '/daily', label: '日次記録', caption: '今日の記録入力を開始', Icon: AssignmentTurnedInRoundedIcon, accent: 'text-sky-600 bg-sky-100', border: 'border-sky-200 hover:border-sky-300 hover:bg-sky-50' },
    { to: '/checklist', label: '自己点検チェックリスト', caption: '監査前チェックを実施', Icon: ChecklistRoundedIcon, accent: 'text-gray-600 bg-gray-100', border: 'border-gray-200 hover:border-gray-300 hover:bg-gray-50' },
  ] as const;

  const userItems = users ?? [];
  const staffItems = staff ?? [];

  return (
    <Container maxWidth="xl" component="main" sx={{ py: 4 }}>
      <Stack spacing={4}>
        {/* ヘッダーセクション */}
        <Box component="section" aria-labelledby="home-heading">
          <Typography variant="h3" component="h1" fontWeight={700} gutterBottom id="home-heading">
            Audit Management – ホーム
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Chip
              icon={<FiberManualRecordRoundedIcon />}
              label={demoModeEnabled ? 'デモモードが有効です' : '本番モード（MSAL 認証あり）'}
              color={demoModeEnabled ? 'success' : 'warning'}
              variant="outlined"
            />
          </Stack>
        </Box>

        {/* 主要機能セクション */}
        <Box component="section" aria-label="主要機能">
          <Box
            display="grid"
            gridTemplateColumns={{
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            }}
            gap={3}
          >
            {tiles
              .filter((tile) => schedulesEnabled || tile.to !== '/schedule')
              .map(({ to, label, caption, Icon }) => (
                <Card
                  key={to}
                  variant="outlined"
                  sx={{
                    height: '100%',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                    }
                  }}
                >
                  <CardActionArea
                    component={NavLink}
                    to={to}
                    sx={{ height: '100%', p: 3 }}
                    aria-label={`${label}へ移動`}
                  >
                    <Stack spacing={2} height="100%">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                          <Icon />
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="h6" component="h2" gutterBottom>
                            {label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {caption}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" alignItems="center" justifyContent="flex-end" mt="auto">
                        <Typography variant="body2" color="primary.main" fontWeight={500}>
                          詳細を開く
                        </Typography>
                        <ArrowForwardRoundedIcon color="primary" fontSize="small" sx={{ ml: 0.5 }} />
                      </Stack>
                    </Stack>
                  </CardActionArea>
                </Card>
            ))}
          </Box>
        </Box>

        {/* 最新情報セクション */}
        <Box component="section" aria-label="最新情報">
          <Box
            display="grid"
            gridTemplateColumns={{
              xs: '1fr',
              md: 'repeat(3, 1fr)',
            }}
            gap={3}
          >
            {schedulesEnabled ? (
              <SectionCard title={`今日の予定（${dateISO}）`} to="/schedule">
                <Box minHeight={120}>
                  <Stack spacing={2}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                      <Chip size="small" color={sourceChipColor} variant="outlined" label={`データソース: ${sourceChipLabel}`} />
                      {fallbackKindLabel && (
                        <Typography variant="caption" color="text.secondary">
                          原因: {fallbackKindLabel}
                        </Typography>
                      )}
                    </Box>
                    {schedulesSource === 'demo' && schedulesFallbackError && (
                      <Box
                        role="alert"
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'error.light',
                          bgcolor: 'error.lighter',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="caption" color="error.main">
                          SharePoint 連携に失敗したため、予定はデモデータです（保存されていません）。
                        </Typography>
                      </Box>
                    )}
                    {schedulesLoading ? (
                      <Stack spacing={1}>
                        <Box height={24} width={96} bgcolor="grey.200" borderRadius={1} />
                        <Box height={24} width={192} bgcolor="grey.200" borderRadius={1} />
                        <Box height={24} width={144} bgcolor="grey.200" borderRadius={1} />
                      </Stack>
                    ) : schedulesError ? (
                      <Typography variant="body2" color="error">予定の読み込みに失敗しました</Typography>
                    ) : schedules.length ? (
                      <Stack spacing={1}>
                        {schedules.map((item) => (
                          <Box key={item.id} display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                            <Box flex={1} minWidth={0}>
                              <Typography variant="body2" noWrap title={item.title || ''}>
                                {item.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.startText}
                              </Typography>
                            </Box>
                            <Box>
                              {item.allDay ? (
                                <Chip size="small" variant="outlined" color="info" label="終日" />
                              ) : item.status ? (
                                <Chip size="small" variant="outlined" label={item.status} />
                              ) : null}
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">本日の予定はありません</Typography>
                    )}
                  </Stack>
                </Box>
              </SectionCard>
            ) : null}

            <SectionCard title="利用者（最近の更新）" to="/users">
              {usersStatus === 'loading' ? (
                <Typography variant="body2" color="text.secondary">読み込み中...</Typography>
              ) : usersError ? (
                <Typography variant="body2" color="error">利用者データの読み込みに失敗しました</Typography>
              ) : userItems.length ? (
                <Stack spacing={1}>
                  {userItems.slice(0, 5).map((user) => (
                    <Box key={user.Id} display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" noWrap>
                          {user.FullName || '氏名未設定'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          #{user.UserID} / {user.Furigana || user.FullNameKana || 'ふりがな未登録'}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={user.IsActive !== false ? 'success' : 'default'}
                        variant={user.IsActive !== false ? 'filled' : 'outlined'}
                        label={user.IsActive !== false ? '在籍' : '退所'}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">データがありません</Typography>
              )}
            </SectionCard>

            <SectionCard title="職員（最近の更新）" to="/staff">
              {staffItems.length ? (
                <Stack spacing={1}>
                  {staffItems.slice(0, 5).map((member) => (
                    <Box key={member.id} display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" noWrap>
                          {member.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {member.role || '役割未設定'}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={member.active !== false ? 'success' : 'default'}
                        variant={member.active !== false ? 'filled' : 'outlined'}
                        label={member.active !== false ? '在籍' : '退職'}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">データがありません</Typography>
              )}
            </SectionCard>
          </Box>
        </Box>

  {/* SharePoint デバッグ（開発時のみ表示） */}
  {getAppConfig().isDev && <SharePointListDebug />}
      </Stack>
    </Container>
  );
}
