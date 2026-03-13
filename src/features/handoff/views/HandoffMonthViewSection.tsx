/**
 * HandoffMonthViewSection — 月ビューの薄いラッパー
 *
 * 月ビュー用 ViewModel (useHandoffMonthViewModel) の呼び出しと
 * 表示タイトルを管理し、既存の HandoffMonthView に委譲する。
 */
import { Box, Typography } from '@mui/material';
import { HandoffMonthView } from '../components/HandoffMonthView';
import { useHandoffMonthViewModel } from '../hooks/useHandoffMonthViewModel';

export type HandoffMonthViewSectionProps = {
  /** 基準日 (YYYY-MM-DD) */
  date: string;
  /** 表示用日付ラベル */
  dateLabel: string;
  /** 日カードクリック時に day ビューへ遷移する */
  onDayClick: (date: string) => void;
};

export function HandoffMonthViewSection({
  date,
  dateLabel,
  onDayClick,
}: HandoffMonthViewSectionProps) {
  const monthVM = useHandoffMonthViewModel(date);

  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
        {dateLabel}の申し送り
      </Typography>
      <HandoffMonthView
        summary={monthVM.summary}
        loading={monthVM.loading}
        error={monthVM.error}
        onDayClick={onDayClick}
      />
    </Box>
  );
}
