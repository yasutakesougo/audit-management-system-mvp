// ---------------------------------------------------------------------------
// IBDHubPage — 強度行動障害支援ステータスボード
//
// 4つのワークフロー段階を「ライブ状況 + アクション導線」で表示する
// オペレーションボード。SP フックからメトリクスを取得し、
// ドリルダウンで /admin/individual-support/:userCode へ遷移する。
// ---------------------------------------------------------------------------
import { ASSESSMENT_DRAFT_KEY } from '@/features/assessment/domain/assessmentSchema';
import { IBDPageHeader } from '@/features/ibd/components/IBDPageHeader';
import { useSPSAlerts } from '@/features/ibd/useSPSAlerts';
import { useSupportStepTemplates } from '@/features/support/hooks/useSupportStepTemplates';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BuildIcon from '@mui/icons-material/Build';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme, type Theme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusLink {
  label: string;
  to: string;
  primary?: boolean;
  /** true = ドリルダウンダイアログを開く（直接遷移しない） */
  drilldown?: boolean;
}

interface StatusSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  metrics: Array<{ label: string; value: string | number }>;
  links: StatusLink[];
  alert?: string;
  alertSeverity?: 'warning' | 'error';
}

// ---------------------------------------------------------------------------
// Hooks — テンプレート件数の集約
// ---------------------------------------------------------------------------

/** IBD対象者ごとのテンプレート件数を集計 */
function useTemplateMetrics(ibdUsers: Array<{ UserID: string; FullName: string }>) {
  // 代表ユーザー（最初の1名）のテンプレートを取得してカウント
  const firstUserCode = ibdUsers[0]?.UserID ?? null;
  const { templates, isLoading } = useSupportStepTemplates(firstUserCode);

  return useMemo(() => ({
    totalTemplates: templates.length,
    isLoading,
    userCount: ibdUsers.length,
  }), [templates.length, isLoading, ibdUsers.length]);
}

// ---------------------------------------------------------------------------
// Hooks — ステータス情報の集約（SP連動版）
// ---------------------------------------------------------------------------

function useHubStatus(
  theme: Theme,
  ibdUsers: Array<{ UserID: string; FullName: string }>,
  templateMetrics: { totalTemplates: number; isLoading: boolean; userCount: number },
  spsAlerts: ReturnType<typeof useSPSAlerts>,
): StatusSection[] {
  return useMemo(() => {
    // アセスメントドラフトの有無（localStorage — まだ SP 化されていない）
    const hasDraft = (() => {
      try {
        const raw = localStorage.getItem(ASSESSMENT_DRAFT_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Object.keys(parsed?.data ?? {}).length > 0;
      } catch {
        return false;
      }
    })();

    return [
      // ── 評価 ──
      {
        id: 'assessment',
        icon: <AssessmentIcon />,
        title: '評価',
        description: '利用者の特性・感覚プロファイルを評価し支援の土台を作る',
        accentColor: theme.palette.success.dark,
        metrics: [
          { label: 'IBD対象者', value: `${ibdUsers.length}名` },
          { label: 'ドラフト', value: hasDraft ? '未完了あり' : 'なし' },
        ],
        links: [
          { label: 'アセスメント', to: '/assessment' },
          { label: '特性アンケート', to: '/survey/tokusei', primary: true },
        ],
        alert: hasDraft ? '📝 未完了のドラフトがあります' : undefined,
        alertSeverity: 'warning' as const,
      },
      // ── 分析 ──
      {
        id: 'analysis',
        icon: <TimelineIcon />,
        title: '分析',
        description: '行動の傾向を可視化し背景要因を構造化して仮説を立てる',
        accentColor: theme.palette.primary.main,
        metrics: [],
        links: [
          { label: '行動分析ダッシュボード', to: '/analysis/dashboard', primary: true },
          { label: '氷山モデル分析', to: '/analysis/iceberg' },
          { label: '氷山PDCA', to: '/analysis/iceberg-pdca' },
        ],
      },
      // ── 支援設計 ──
      {
        id: 'design',
        icon: <BuildIcon />,
        title: '支援設計',
        description: '場面別の手順書・個別支援計画を作成しチームで共有する',
        accentColor: theme.palette.warning.dark ?? theme.palette.warning.main,
        metrics: [
          {
            label: 'テンプレート',
            value: templateMetrics.isLoading
              ? '読込中…'
              : `${templateMetrics.totalTemplates}件`,
          },
          { label: 'IBD対象者', value: `${templateMetrics.userCount}名` },
        ],
        links: [
          { label: '支援活動マスタ', to: '/admin/templates', primary: true },
          { label: '支援手順マスタ', to: '/admin/step-templates' },
          { label: '個別支援手順 →', to: '/admin/individual-support', drilldown: true },
        ],
        alert: spsAlerts.hasAlerts
          ? `⚠️ SPS更新期限に注意が必要な利用者が${spsAlerts.alerts.length}名います`
          : undefined,
        alertSeverity: spsAlerts.worstLevel === 'error' ? 'error' as const : 'warning' as const,
      },
      // ── モニタリング ──
      {
        id: 'monitor',
        icon: <PsychologyIcon />,
        title: 'モニタリング',
        description: '現場の記録を追跡し支援の効果を継続的に確認する',
        accentColor: theme.palette.info.dark ?? theme.palette.info.main,
        metrics: [
          ...(spsAlerts.overdueCount > 0
            ? [{ label: '期限超過', value: `${spsAlerts.overdueCount}件` }]
            : []),
          ...(spsAlerts.warningCount > 0
            ? [{ label: '更新間近', value: `${spsAlerts.warningCount}件` }]
            : []),
        ],
        links: [
          { label: '日次記録（行動観察）', to: '/daily/table', primary: true },
          { label: '健康バイタル', to: '/daily/health' },
          { label: '申し送りタイムライン', to: '/handoff-timeline' },
        ],
        alert: spsAlerts.overdueCount > 0
          ? `🔴 SPS更新期限が超過している利用者が${spsAlerts.overdueCount}名います`
          : undefined,
        alertSeverity: 'error' as const,
      },
    ];
  }, [theme.palette, ibdUsers.length, templateMetrics, spsAlerts]);
}

// ---------------------------------------------------------------------------
// Status Card
// ---------------------------------------------------------------------------

function StatusCard({
  section,
  onNavigate,
  onDrilldown,
}: {
  section: StatusSection;
  onNavigate: (to: string) => void;
  onDrilldown: () => void;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderTop: `4px solid ${section.accentColor}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, p: 3 }}>
        {/* Header */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ color: section.accentColor, display: 'flex', '& .MuiSvgIcon-root': { fontSize: 28 } }}>
            {section.icon}
          </Box>
          <Typography variant="h6" fontWeight={700}>
            {section.title}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {section.description}
        </Typography>

        {/* Alert */}
        {section.alert && (
          <Chip
            icon={section.alertSeverity === 'error' ? <WarningAmberIcon /> : undefined}
            label={section.alert}
            color={section.alertSeverity === 'error' ? 'error' : 'warning'}
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-start' }}
          />
        )}

        {/* Metrics */}
        {section.metrics.length > 0 && (
          <>
            <Divider />
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {section.metrics.map((m) => (
                <Box key={m.label}>
                  <Typography variant="caption" color="text.secondary">
                    {m.label}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {m.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}

        {/* Actions */}
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Divider sx={{ mb: 1.5 }} />
          <Stack spacing={1}>
            {section.links.map((link) => (
              <Button
                key={link.to}
                variant={link.primary ? 'contained' : 'text'}
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => link.drilldown ? onDrilldown() : onNavigate(link.to)}
                sx={{
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  fontWeight: link.primary ? 600 : 400,
                  ...(link.primary
                    ? { bgcolor: section.accentColor, '&:hover': { bgcolor: section.accentColor, filter: 'brightness(0.9)' } }
                    : { color: 'text.secondary' }),
                }}
              >
                {link.label}
              </Button>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Drilldown Dialog
// ---------------------------------------------------------------------------

interface DrilldownDialogProps {
  open: boolean;
  onClose: () => void;
  users: Array<{ Id: number; UserID: string; FullName: string }>;
  onSelectUser: (userCode: string) => void;
}

function DrilldownDialog({ open, onClose, users, onSelectUser }: DrilldownDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={600}>
          対象利用者を選択
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          個別支援手順の管理画面に移動します。
        </Typography>
        <Stack spacing={1.5}>
          {users.map((user) => (
            <Card key={user.Id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardActionArea
                onClick={() => {
                  onSelectUser(user.UserID);
                  onClose();
                }}
                sx={{ p: 2 }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <PersonIcon sx={{ fontSize: 36, color: 'primary.main' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {user.FullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.UserID}
                    </Typography>
                  </Box>
                  <ArrowForwardIcon color="action" />
                </Stack>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const IBDHubPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: allUsers } = useUsersDemo();
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  // IBD対象者のみ
  const ibdUsers = useMemo(
    () => allUsers.filter((u) => u.IsHighIntensitySupportTarget),
    [allUsers],
  );

  // SP メトリクス
  const templateMetrics = useTemplateMetrics(ibdUsers);
  const spsAlerts = useSPSAlerts(30);

  // ステータスカードデータ
  const sections = useHubStatus(theme, ibdUsers, templateMetrics, spsAlerts);

  const handleDrilldown = (userCode: string) => {
    navigate(`/admin/individual-support/${userCode}`);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }} data-testid="ibd-hub-page">
      <IBDPageHeader
        title="強度行動障害支援"
        subtitle="評価 → 分析 → 支援設計 → モニタリング。支援の全工程をここから管理します。"
        icon={<TrendingUpIcon />}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {sections.map((section) => (
          <StatusCard
            key={section.id}
            section={section}
            onNavigate={(to) => navigate(to)}
            onDrilldown={() => setDrilldownOpen(true)}
          />
        ))}
      </Box>

      {/* Drilldown Dialog */}
      <DrilldownDialog
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        users={ibdUsers}
        onSelectUser={handleDrilldown}
      />
    </Container>
  );
};

export default IBDHubPage;
