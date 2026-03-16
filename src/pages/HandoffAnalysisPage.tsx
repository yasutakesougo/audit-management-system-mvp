/**
 * 申し送り分析ダッシュボードページ
 *
 * /handoff-analysis で表示される。
 * 申し送りデータを取得し、HandoffAnalysisDashboard に渡す。
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import HandoffAnalysisDashboard from '@/features/handoff/analysis/components/HandoffAnalysisDashboard';

// ── データ取得（将来的にはリポジトリ層から取得） ──

function useHandoffRecords() {
  const [records, setRecords] = useState<HandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: 実際のリポジトリからデータを取得する
    // handoff リポジトリの getAllRecords() と接続予定
    try {
      setRecords([]);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '申し送りの取得に失敗しました');
      setLoading(false);
    }
  }, []);

  return { records, loading, error };
}

export default function HandoffAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { records, loading, error } = useHandoffRecords();

  // URL パラメータ（将来的に期間フィルタ等に使用）
  const _daysParam = searchParams.get('days');

  const handleBack = useCallback(() => {
    navigate('/handoff-timeline');
  }, [navigate]);

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

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
            申し送りに戻る
          </Button>
          <Typography color="error">{error}</Typography>
        </Stack>
      </Container>
    );
  }

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
