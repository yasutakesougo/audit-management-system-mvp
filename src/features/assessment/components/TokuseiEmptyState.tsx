/**
 * TokuseiEmptyState.tsx — Empty state panel for TokuseiSurveyResultsPage.
 *
 * Extracted from TokuseiSurveyResultsPage.tsx (L56-108).
 * Stateless presentational component.
 */
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

type Props = {
  variant: 'all' | 'filtered';
  hasFormsUrl: boolean;
  formsUrl?: string;
  onResetFilters?: () => void;
};

const TokuseiEmptyState: React.FC<Props> = ({ variant, hasFormsUrl, formsUrl, onResetFilters }) => {
  const title =
    variant === 'all'
      ? '特性アンケートの回答がまだありません'
      : '条件に一致する回答がありません';
  const description =
    variant === 'all'
      ? 'Microsoft Formsで回答が送信されると、ここに表示されます。'
      : '検索や日付フィルタを緩めると表示される可能性があります。';

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
          {variant === 'filtered' && onResetFilters && (
            <Button variant="outlined" onClick={onResetFilters}>
              フィルタをリセット
            </Button>
          )}
          {hasFormsUrl ? (
            <Button
              variant="contained"
              component="a"
              href={formsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Formsで回答を送る
            </Button>
          ) : (
            <Button variant="contained" disabled title="VITE_TOKUSEI_FORMS_URL が未設定です">
              Formsで回答を送る
            </Button>
          )}
        </Stack>

        {!hasFormsUrl && (
          <Typography variant="caption" color="text.secondary">
            管理者向け: .env に VITE_TOKUSEI_FORMS_URL を設定すると、ここにFormsへの導線が表示されます。
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default TokuseiEmptyState;
