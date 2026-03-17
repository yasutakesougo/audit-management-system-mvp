/**
 * IncidentListPage — インシデント履歴一覧ページ
 *
 * タイムラインから `sourceRef.incidentId` 付きで遷移すると、
 * 該当インシデントをハイライト表示する。
 *
 * クエリパラメータ:
 *   - ?incidentId=xxx  該当レコードをハイライト
 */
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import IncidentHistoryList from '@/features/safety/components/IncidentHistoryList';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IncidentListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('incidentId');

  // ハイライト対象の ref（将来のスクロール対応用）
  const highlightRef = useRef<string | null>(highlightId);

  useEffect(() => {
    highlightRef.current = highlightId;
  }, [highlightId]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={3}>
        {/* ── Header ─────────────────────────────── */}
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <WarningAmberRoundedIcon color="warning" sx={{ fontSize: 28 }} />
            <Typography variant="h5" fontWeight={700}>
              インシデント履歴
            </Typography>
          </Stack>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{ textTransform: 'none' }}
          >
            戻る
          </Button>
        </Stack>

        {/* ── Highlight Notice ──────────────────── */}
        {highlightId && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderRadius: 1,
              bgcolor: 'warning.50',
              border: '1px solid',
              borderColor: 'warning.200',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              タイムラインから遷移: インシデント <strong>{highlightId}</strong>
            </Typography>
          </Box>
        )}

        {/* ── Incident List ────────────────────── */}
        <IncidentHistoryList />
      </Stack>
    </Container>
  );
}
