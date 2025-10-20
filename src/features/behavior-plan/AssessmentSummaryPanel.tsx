import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { BehaviorSupportPlan } from '../../types/behaviorPlan';

export interface AssessmentInsight {
  id: string;
  date: string;
  summary: string;
  source?: string;
}

interface AssessmentSummaryPanelProps {
  userId: string;
  userName: string;
  assessmentSummary: BehaviorSupportPlan['assessmentSummary'];
  insights?: AssessmentInsight[];
  sensoryProfile?: string;
  lifeHistory?: string;
}

const AssessmentSummaryPanel: React.FC<AssessmentSummaryPanelProps> = ({
  userId,
  userName,
  assessmentSummary,
  insights = [],
  sensoryProfile,
  lifeHistory,
}) => {
  return (
    <Card elevation={3} sx={{ position: { lg: 'sticky' }, top: { lg: 96 } }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="overline" color="primary">
              利用者
            </Typography>
            <Typography variant="h6">{userName}</Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {userId}
            </Typography>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              行動関連項目合計点数
            </Typography>
            <Typography variant="h4" color="error.main" fontWeight={700}>
              {assessmentSummary.kodoScore} 点
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ※ 18点以上の利用者は中核的人材の関与が必須です。
            </Typography>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              想定される機能仮説
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {assessmentSummary.functionalHypothesis.map((tag) => (
                <Chip key={tag} label={tag} color="warning" variant="outlined" size="small" />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {assessmentSummary.assessmentNotes || 'アセスメント所見は未入力です。'}
            </Typography>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              FBA / ABC分析からの示唆
            </Typography>
            <Stack spacing={1}>
              {insights.map((insight) => (
                <Stack
                  key={insight.id}
                  spacing={0.5}
                  sx={{ borderLeft: '4px solid', borderColor: 'primary.light', pl: 1.5 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {insight.date} {insight.source ? `｜${insight.source}` : ''}
                  </Typography>
                  <Typography variant="body2">{insight.summary}</Typography>
                </Stack>
              ))}
              {insights.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  FBA結果の取り込みを待機しています。
                </Typography>
              )}
            </Stack>
          </Stack>

          <Accordion elevation={0} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">感覚プロファイル評価</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} color="text.secondary">
                {sensoryProfile ?? '感覚プロファイルの情報は未登録です。'}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion elevation={0} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">生活歴調査サマリー</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} color="text.secondary">
                {lifeHistory ?? '生活歴に関する追加情報は未登録です。'}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default AssessmentSummaryPanel;
