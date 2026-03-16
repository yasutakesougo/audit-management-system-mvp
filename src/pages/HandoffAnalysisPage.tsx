/**
 * 申し送り分析ダッシュボードページ
 *
 * /handoff-analysis で表示される。
 * 実データを HandoffApi 経由で取得し、HandoffAnalysisDashboard に渡す。
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import { useHandoffApi } from '@/features/handoff/handoffApi';
import HandoffAnalysisDashboard from '@/features/handoff/analysis/components/HandoffAnalysisDashboard';

/**
 * 分析用に30日分のデータを取得するカスタムフック。
 *
 * HandoffAnalysisDashboard 側で 7/14/30 日フィルタを持っているので、
 * ここでは最大30日分を一括取得し、フィルタは UI 側に任せる。
 */
function useHandoffRecordsForAnalysis() {
  const api = useHandoffApi();
  const [records, setRecords] = useState<HandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getHandoffRecordsForAnalysis(30);
        if (!cancelled) {
          setRecords(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '申し送りの取得に失敗しました');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [api]);

  return { records, loading, error };
}

export default function HandoffAnalysisPage() {
  const navigate = useNavigate();
  const { records, loading, error } = useHandoffRecordsForAnalysis();

  const handleBack = useCallback(() => {
    navigate('/handoff-timeline');
  }, [navigate]);

  // ── ローディング状態 ──
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            申し送りデータを読み込んでいます…
          </Typography>
        </Stack>
      </Container>
    );
  }

  // ── エラー状態 ──
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
            申し送りに戻る
          </Button>
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        </Stack>
      </Container>
    );
  }

  // ── メイン表示 ──
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          size="small"
          sx={{ minWidth: 'auto' }}
        >
          申し送り
        </Button>
      </Stack>

      <HandoffAnalysisDashboard records={records} />
    </Container>
  );
}
