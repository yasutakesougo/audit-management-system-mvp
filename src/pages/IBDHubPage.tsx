// ---------------------------------------------------------------------------
// IBDHubPage — 強度行動障害支援OS（統合ハブ）
//
// 4セクション: 評価(Assessment) → 分析(Analysis) → 支援設計(Design) → モニタリング(Monitor)
// 各 Deep Dive ページへの導線 + メタ情報（件数・最終更新日・未完了ドラフト）
// ---------------------------------------------------------------------------
import { ASSESSMENT_DRAFT_KEY } from '@/features/assessment/domain/assessmentSchema';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BuildIcon from '@mui/icons-material/Build';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InsightsIcon from '@mui/icons-material/Insights';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import QuizIcon from '@mui/icons-material/Quiz';
import ScienceIcon from '@mui/icons-material/Science';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HubCard {
  label: string;
  to: string;
  description: string;
  icon: React.ReactNode;
  meta?: string;           // メタ情報（件数・更新日など）
  badge?: string;           // DEV, 管理者 など
  adminOnly?: boolean;
}

interface HubSection {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  cards: HubCard[];
  highlight?: string;      // 強調メッセージ（未完了ドラフトなど）
}

// ---------------------------------------------------------------------------
// Section Definitions
// ---------------------------------------------------------------------------

function useSections(): HubSection[] {
  return useMemo(() => {
    // TODO Phase 2: ここで assessmentStore / behaviorStore / icebergStore からメタ情報を取得
    // const { getByUserId } = useAssessmentStore();
    // const assessmentDraftExists = localStorage.getItem('assessmentDraft.v1') !== null;

    const assessmentDraftExists = (() => {
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
      // ① 評価（Assessment）
      {
        id: 'assessment',
        emoji: '📋',
        title: '評価',
        subtitle: '利用者の特性・感覚プロファイルを評価し、支援の土台を作る',
        highlight: assessmentDraftExists ? '📝 未完了のドラフトがあります' : undefined,
        cards: [
          {
            label: 'アセスメント',
            to: '/assessment',
            description: '感覚プロファイルの評価・ICF分類に基づくアイテム管理',
            icon: <AssessmentIcon sx={{ fontSize: 32, color: '#2e7d32' }} />,
            meta: assessmentDraftExists ? '下書きあり' : undefined,
          },
          {
            label: '特性アンケート',
            to: '/survey/tokusei',
            description: 'Microsoft Forms連携の特性調査結果の一覧と分析',
            icon: <QuizIcon sx={{ fontSize: 32, color: '#ed6c02' }} />,
          },
        ],
      },

      // ② 分析（Analysis）
      {
        id: 'analysis',
        emoji: '📊',
        title: '分析',
        subtitle: '行動の傾向を可視化し、背景要因を構造化して仮説を立てる',
        cards: [
          {
            label: '行動分析ダッシュボード',
            to: '/analysis/dashboard',
            description: '行動のトレンドチャートと時間帯別ヒートマップで傾向を可視化',
            icon: <TimelineIcon sx={{ fontSize: 32, color: '#1976d2' }} />,
          },
          {
            label: '氷山モデル分析',
            to: '/analysis/iceberg',
            description: '表面的な行動の背景にある環境要因を氷山モデルで構造化',
            icon: <PsychologyIcon sx={{ fontSize: 32, color: '#0288d1' }} />,
          },
          {
            label: '氷山PDCA',
            to: '/analysis/iceberg-pdca',
            description: '氷山分析の仮説を検証し、PDCAサイクルで支援を改善',
            icon: <ScienceIcon sx={{ fontSize: 32, color: '#7b1fa2' }} />,
          },
        ],
      },

      // ③ 支援設計（Design）
      {
        id: 'design',
        emoji: '🛠️',
        title: '支援設計',
        subtitle: '場面別の手順書・個別支援計画を作成し、チームで共有する',
        cards: [
          {
            label: '支援活動マスタ',
            to: '/admin/templates',
            description: '支援活動テンプレートの管理（日課・行事・特別活動）',
            icon: <ListAltIcon sx={{ fontSize: 32, color: '#e65100' }} />,
            adminOnly: true,
          },
          {
            label: '支援手順マスタ',
            to: '/admin/step-templates',
            description: '場面別の支援手順書テンプレートの作成・編集',
            icon: <BuildIcon sx={{ fontSize: 32, color: '#5d4037' }} />,
            adminOnly: true,
          },
          {
            label: '個別支援手順',
            to: '/admin/individual-support',
            description: '利用者ごとの個別支援手順の管理（タイムライン + ABC記録）',
            icon: <DashboardIcon sx={{ fontSize: 32, color: '#1565c0' }} />,
            adminOnly: true,
          },
        ],
      },

      // ④ モニタリング（Monitor）
      {
        id: 'monitor',
        emoji: '👁️',
        title: 'モニタリング',
        subtitle: '現場の記録を追跡し、支援の効果を継続的に確認する',
        cards: [
          {
            label: '日次記録（行動観察）',
            to: '/daily/table',
            description: '日々の行動観察・ABC記録を入力。支援の最前線。',
            icon: <EditNoteIcon sx={{ fontSize: 32, color: '#00897b' }} />,
          },
          {
            label: '申し送りタイムライン',
            to: '/handoff-timeline',
            description: 'シフト交代時の申し送り事項をタイムラインで共有',
            icon: <InsightsIcon sx={{ fontSize: 32, color: '#546e7a' }} />,
          },
          {
            label: '健康バイタル',
            to: '/daily/health',
            description: '体温・血圧・SpO2等のバイタルサインを記録・追跡',
            icon: <MonitorHeartIcon sx={{ fontSize: 32, color: '#c62828' }} />,
          },
        ],
      },
    ];
  }, []);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HubCardComponent({ card, onNavigate }: { card: HubCard; onNavigate: (to: string) => void }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
      }}
    >
      <CardActionArea onClick={() => onNavigate(card.to)} sx={{ p: 0 }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ mt: 0.5 }}>{card.icon}</Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {card.label}
              </Typography>
              {card.adminOnly && (
                <Chip label="管理者" size="small" color="warning" variant="outlined" />
              )}
              {card.badge && (
                <Chip label={card.badge} size="small" variant="outlined" />
              )}
              {card.meta && (
                <Chip label={card.meta} size="small" color="info" variant="filled" />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {card.description}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function HubSectionComponent({
  section,
  onNavigate,
}: {
  section: HubSection;
  onNavigate: (to: string) => void;
}) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {section.emoji} {section.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {section.subtitle}
      </Typography>
      {section.highlight && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
          {section.highlight}
        </Alert>
      )}
      <Stack spacing={1.5}>
        {section.cards.map((card) => (
          <HubCardComponent key={card.to} card={card} onNavigate={onNavigate} />
        ))}
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const IBDHubPage: React.FC = () => {
  const navigate = useNavigate();
  const sections = useSections();

  return (
    <Container maxWidth="md" sx={{ py: 4 }} data-testid="ibd-hub-page">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <TrendingUpIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight={700}>
            強度行動障害支援
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
          評価 → 分析 → 支援設計 → モニタリング。
          支援の全工程をここから管理します。
        </Typography>
      </Box>

      {/* Sections */}
      <Stack spacing={3}>
        {sections.map((section) => (
          <HubSectionComponent
            key={section.id}
            section={section}
            onNavigate={(to) => navigate(to)}
          />
        ))}
      </Stack>
    </Container>
  );
};

export default IBDHubPage;
