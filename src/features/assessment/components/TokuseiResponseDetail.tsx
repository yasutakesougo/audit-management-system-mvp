/**
 * TokuseiResponseDetail.tsx — Detail panel for a single TokuseiSurveyResponse.
 *
 * Extracted from TokuseiSurveyResultsPage.tsx (L403-522).
 * Renders basic info chips + feature chip lists + text fields.
 * Stateless presentational component.
 */
import { type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import FeatureChipList from '@/features/assessment/components/FeatureChipList';
import { Card, CardContent, CardHeader } from '@mui/material';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { formatDateTime } from '../tokuseiSurveyHelpers';

// ---------------------------------------------------------------------------
// TokuseiDetailField — micro component (label + value text)
// ---------------------------------------------------------------------------

const TokuseiDetailField: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Box>
    <Typography variant="subtitle2" component="span" color="text.secondary" gutterBottom>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
      {value ?? '未入力'}
    </Typography>
  </Box>
);

// ---------------------------------------------------------------------------
// TokuseiResponseDetail
// ---------------------------------------------------------------------------

type Props = {
  response: TokuseiSurveyResponse | null;
  isLoading?: boolean;
};

const TokuseiResponseDetail: React.FC<Props> = ({ response, isLoading }) => {
  if (isLoading && !response) {
    return <Skeleton variant="rectangular" height={300} />;
  }

  if (!response) {
    return (
      <Box textAlign="center" py={6}>
        <Typography variant="body1" color="text.secondary">
          表示する回答を選択してください
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* 基本情報 */}
      <Card variant="outlined">
        <CardHeader
          title="基本情報"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          sx={{ pb: 0.5 }}
        />
        <CardContent sx={{ pt: 1.5 }}>
          <Stack spacing={1.2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={response.targetUserName || '対象者未設定'} color="primary" />
              <Chip label={`回答者: ${response.responderName || '未設定'}`} variant="outlined" />
              <Chip label={`記入日時: ${formatDateTime(response.fillDate)}`} variant="outlined" />
              {response.guardianName && (
                <Chip
                  label={`保護者: ${response.guardianName}${response.relation ? `（${response.relation}）` : ''}`}
                  variant="outlined"
                />
              )}
              {(response.heightCm != null || response.weightKg != null) && (
                <Chip
                  label={[
                    response.heightCm != null ? `${response.heightCm}cm` : null,
                    response.weightKg != null ? `${response.weightKg}kg` : null,
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                  variant="outlined"
                  size="small"
                />
              )}
            </Stack>
            {response.responderEmail && (
              <Typography variant="body2" color="text.secondary">
                {`メール: ${response.responderEmail}`}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* 性格・対人関係 */}
      <Card variant="outlined">
        <CardHeader
          title="性格・対人関係"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          sx={{ pb: 0.5 }}
        />
        <CardContent sx={{ pt: 1.5 }}>
          <FeatureChipList value={response.personality} />
        </CardContent>
      </Card>

      {/* 感覚の特徴 */}
      <Card variant="outlined">
        <CardHeader
          title="感覚の特徴"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          sx={{ pb: 0.5 }}
        />
        <CardContent sx={{ pt: 1.5 }}>
          <FeatureChipList value={response.sensoryFeatures} />
        </CardContent>
      </Card>

      {/* 行動・コミュニケーション */}
      <Card variant="outlined">
        <CardHeader
          title="行動・コミュニケーション"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          sx={{ pb: 0.5 }}
        />
        <CardContent sx={{ pt: 1.5 }}>
          <FeatureChipList value={response.behaviorFeatures} />
        </CardContent>
      </Card>

      {/* 得意なこと・強み */}
      <Card variant="outlined">
        <CardHeader
          title="得意なこと・強み"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          sx={{ pb: 0.5 }}
        />
        <CardContent sx={{ pt: 1.5 }}>
          <TokuseiDetailField label="" value={response.strengths} />
        </CardContent>
      </Card>

      {/* 特記事項 */}
      <Card variant="outlined">
        <CardHeader
          title="特記事項"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          sx={{ pb: 0.5 }}
        />
        <CardContent sx={{ pt: 1.5 }}>
          <TokuseiDetailField label="" value={response.notes} />
        </CardContent>
      </Card>
    </Stack>
  );
};

export default TokuseiResponseDetail;
