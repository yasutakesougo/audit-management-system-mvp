/**
 * ReviewRecommendationBanner — 支援計画見直し推奨バナー
 *
 * リスクスコアが閾値を超えた利用者の支援計画シートに表示する。
 * 6層モデル: 第2層（解釈）→ 第4層（計画）の接続UI。
 */
import React from 'react';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import type { ReviewRecommendation, ReviewUrgency } from '../reviewRecommendation';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface Props {
  /** 見直し提案データ */
  recommendation: ReviewRecommendation;
  /** ダッシュボードへの遷移ハンドラ */
  onNavigateToDashboard?: () => void;
  /** 閉じるハンドラ */
  onDismiss?: () => void;
}

// ────────────────────────────────────────────────────────────
// Urgency → UI mapping
// ────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<ReviewUrgency, {
  severity: 'error' | 'warning' | 'info';
  label: string;
  chipColor: 'error' | 'warning' | 'info';
}> = {
  urgent: { severity: 'error', label: '緊急', chipColor: 'error' },
  recommended: { severity: 'warning', label: '推奨', chipColor: 'warning' },
  suggested: { severity: 'info', label: '検討', chipColor: 'info' },
  none: { severity: 'info', label: '', chipColor: 'info' },
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export const ReviewRecommendationBanner: React.FC<Props> = ({
  recommendation,
  onNavigateToDashboard,
  onDismiss,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const config = URGENCY_CONFIG[recommendation.urgency];

  if (recommendation.urgency === 'none') return null;

  return (
    <Alert
      severity={config.severity}
      variant="outlined"
      icon={<WarningAmberRoundedIcon />}
      onClose={onDismiss}
      sx={{
        '& .MuiAlert-message': { width: '100%' },
        borderWidth: recommendation.urgency === 'urgent' ? 2 : 1,
      }}
    >
      <AlertTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2" fontWeight={700}>
            支援計画の見直し{config.label}
          </Typography>
          <Chip
            size="small"
            label={`リスクスコア: ${recommendation.riskScore}`}
            color={config.chipColor}
            variant="outlined"
            sx={{ height: 20, '& .MuiChip-label': { px: 0.8, fontSize: '0.7rem' } }}
          />
        </Stack>
      </AlertTitle>

      <Typography variant="body2" sx={{ mb: 1 }}>
        {recommendation.summary}
      </Typography>

      {recommendation.proposedSections.length > 0 && (
        <>
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ mb: 0.5, textTransform: 'none' }}
          >
            {expanded ? '詳細を閉じる' : `見直し対象: ${recommendation.proposedSections.length}セクション — 詳細を見る`}
          </Button>

          <Collapse in={expanded}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Divider />
              {recommendation.proposedSections.map((section, i) => (
                <Stack key={i} spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      label={section.section}
                      color="default"
                      variant="outlined"
                      sx={{ height: 20 }}
                    />
                    <Typography variant="body2" fontWeight={600}>
                      {section.sectionName}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {section.reason}
                  </Typography>
                  {section.evidence.length > 0 && (
                    <Stack spacing={0.25} sx={{ pl: 1 }}>
                      {section.evidence.slice(0, 3).map((e, j) => (
                        <Typography key={j} variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          • {e.length > 80 ? `${e.slice(0, 80)}…` : e}
                        </Typography>
                      ))}
                    </Stack>
                  )}
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </>
      )}

      {onNavigateToDashboard && (
        <Button
          size="small"
          variant="text"
          endIcon={<OpenInNewRoundedIcon />}
          onClick={onNavigateToDashboard}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          申し送り分析ダッシュボードで詳細を確認
        </Button>
      )}
    </Alert>
  );
};
