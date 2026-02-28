// ---------------------------------------------------------------------------
// IBDHubPage — 強度行動障害支援ステータスボード
//
// 4つのワークフロー段階を「ライブ状況 + アクション導線」で表示する
// オペレーションボード。静的なディレクトリではなく、現場スタッフが
// 「今何をすべきか」を瞬時に把握するための起点。
// ---------------------------------------------------------------------------
import { ASSESSMENT_DRAFT_KEY } from '@/features/assessment/domain/assessmentSchema';
import { IBDPageHeader } from '@/features/ibd/components/IBDPageHeader';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusLink {
  label: string;
  to: string;
  primary?: boolean;
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
}

// ---------------------------------------------------------------------------
// Hooks — ステータス情報の集約
// ---------------------------------------------------------------------------

function useHubStatus(): StatusSection[] {
  return useMemo(() => {
    // アセスメントドラフトの有無
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

    // 支援活動マスタのメタ情報
    const activityMeta = (() => {
      try {
        const raw = localStorage.getItem('ams.supportActivityTemplates.meta.v1');
        if (!raw) return { count: 0, updatedAt: '' };
        const parsed = JSON.parse(raw) as { count?: number; updatedAt?: string };
        return {
          count: typeof parsed.count === 'number' ? parsed.count : 0,
          updatedAt: parsed.updatedAt
            ? new Date(parsed.updatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
            : '',
        };
      } catch {
        return { count: 0, updatedAt: '' };
      }
    })();

    return [
      {
        id: 'assessment',
        icon: <AssessmentIcon />,
        title: '評価',
        description: '利用者の特性・感覚プロファイルを評価し支援の土台を作る',
        accentColor: '#2e7d32',
        metrics: [
          { label: 'ドラフト', value: hasDraft ? '未完了あり' : 'なし' },
        ],
        links: [
          { label: 'アセスメント', to: '/assessment' },
          { label: '特性アンケート', to: '/survey/tokusei', primary: true },
        ],
        alert: hasDraft ? '📝 未完了のドラフトがあります' : undefined,
      },
      {
        id: 'analysis',
        icon: <TimelineIcon />,
        title: '分析',
        description: '行動の傾向を可視化し背景要因を構造化して仮説を立てる',
        accentColor: '#1976d2',
        metrics: [],
        links: [
          { label: '行動分析ダッシュボード', to: '/analysis/dashboard', primary: true },
          { label: '氷山モデル分析', to: '/analysis/iceberg' },
          { label: '氷山PDCA', to: '/analysis/iceberg-pdca' },
        ],
      },
      {
        id: 'design',
        icon: <BuildIcon />,
        title: '支援設計',
        description: '場面別の手順書・個別支援計画を作成しチームで共有する',
        accentColor: '#e65100',
        metrics: [
          { label: 'テンプレート', value: activityMeta.count > 0 ? `${activityMeta.count}件` : '未作成' },
          ...(activityMeta.updatedAt ? [{ label: '最終更新', value: activityMeta.updatedAt }] : []),
        ],
        links: [
          { label: '支援活動マスタ', to: '/admin/templates', primary: true },
          { label: '支援手順マスタ', to: '/admin/step-templates' },
          { label: '個別支援手順', to: '/admin/individual-support' },
        ],
      },
      {
        id: 'monitor',
        icon: <PsychologyIcon />,
        title: 'モニタリング',
        description: '現場の記録を追跡し支援の効果を継続的に確認する',
        accentColor: '#00695c',
        metrics: [],
        links: [
          { label: '日次記録（行動観察）', to: '/daily/table', primary: true },
          { label: '健康バイタル', to: '/daily/health' },
          { label: '申し送りタイムライン', to: '/handoff-timeline' },
        ],
      },
    ];
  }, []);
}

// ---------------------------------------------------------------------------
// Status Card
// ---------------------------------------------------------------------------

function StatusCard({
  section,
  onNavigate,
}: {
  section: StatusSection;
  onNavigate: (to: string) => void;
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
            label={section.alert}
            color="warning"
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
                onClick={() => onNavigate(link.to)}
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
// Page
// ---------------------------------------------------------------------------

const IBDHubPage: React.FC = () => {
  const navigate = useNavigate();
  const sections = useHubStatus();

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
          />
        ))}
      </Box>
    </Container>
  );
};

export default IBDHubPage;
