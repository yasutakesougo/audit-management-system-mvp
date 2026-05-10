import React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PersonIcon from '@mui/icons-material/Person';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BuildIcon from '@mui/icons-material/Build';
import RateReviewIcon from '@mui/icons-material/RateReview';

interface HubItem {
  id: string;
  title: string;
  description: string;
  actionText: string;
  to: string;
  icon: React.ReactNode;
  color: string;
}

export const SupportReviewHubPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const items: HubItem[] = [
    {
      id: 'plan-list',
      title: '1. 現在の支援計画を見る',
      description: 'いま有効な支援計画の一覧と、それらの見直し（モニタリング・再評価）の状況を確認します。',
      actionText: '計画シート一覧を表示する',
      to: '/planning-sheet-list',
      icon: <AssessmentIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.primary.main,
    },
    {
      id: 'assessment',
      title: '2. 本人の特性を確認する',
      description: '利用者の強み、困りごと、感覚特性（感覚プロファイル）などを整理し、見取り図を作成・更新します。',
      actionText: 'アセスメント管理を開く',
      to: '/assessment',
      icon: <PersonIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.success.main,
    },
    {
      id: 'analysis',
      title: '3. 困りごとの背景を整理する',
      description: '生活上生じている課題行動の背景にある環境要因や引き金（トリガー）を、氷山モデルを用いて構造分析します。',
      actionText: '分析ワークスペースを開く',
      to: '/analysis',
      icon: <PsychologyIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.warning.main,
    },
    {
      id: 'new-plan',
      title: '4. 支援計画に反映する',
      description: 'アセスメント特性や氷山分析の結果（背景要因・介入案）を取り込み、新期・更新用の個別支援計画シートを作成します。',
      actionText: '新しい計画シートを作成する',
      to: '/support-planning-sheet/new',
      icon: <BuildIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.info.main,
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }} data-testid="support-review-hub-page">
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'action.selected',
              color: 'primary.main',
            }}
          >
            <RateReviewIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">
              支援の確認・見直し
            </Typography>
            <Typography variant="body2" color="text.secondary">
              利用者の支援状況を総合的に把握し、特性・背景分析・支援計画をチームで連動させながら改善します。
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ mt: 3 }} />
      </Box>

      {/* Grid of Pathways */}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            md: '1fr 1fr',
          },
        }}
      >
        {items.map((item) => (
          <Card
            key={item.id}
            variant="outlined"
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
                borderColor: item.color,
              },
            }}
          >
            <CardActionArea
              onClick={() => navigate(item.to)}
              sx={{ height: '100%', display: 'flex', alignItems: 'stretch' }}
            >
              {/* Vertical Color Indicator */}
              <Box sx={{ width: 8, bgcolor: item.color }} />

              <CardContent sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Header Block */}
                <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                      {item.title}
                    </Typography>
                  </Box>
                  <Box sx={{ color: item.color, mt: 0.5 }}>
                    {item.icon}
                  </Box>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ flex: 1, lineHeight: 1.6 }}>
                  {item.description}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: item.color, fontWeight: 600, fontSize: '0.875rem', mt: 'auto', pt: 1 }}>
                  <span>{item.actionText}</span>
                  <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Container>
  );
};

export default SupportReviewHubPage;
