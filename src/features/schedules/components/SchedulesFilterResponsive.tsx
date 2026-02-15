import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack, { type StackProps } from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { TESTIDS } from '@/testids';

export interface SchedulesFilterResponsiveProps {
  /** フィルタコントロール一式（Select / TextField / チェックボックスなど） */
  children: React.ReactNode;
  /** デスクトップ表示時の Stack カスタマイズ。 */
  inlineStackProps?: StackProps;
  /** ダイアログタイトルを上書きしたい場合に指定。 */
  dialogTitle?: string;
  /** ダイアログで案内メッセージを差し替えたい場合に指定。 */
  dialogDescription?: React.ReactNode;
  /** Tablet landscape などで dialog-only にしたい場合に指定。 */
  compact?: boolean;
}

const DEFAULT_DIALOG_TITLE = 'スケジュールの絞り込み';
const DEFAULT_DIALOG_DESCRIPTION = (
  <Typography variant="body2" color="text.secondary">
    サービス種別・利用者・職員・ステータスなどで絞り込みできます。
  </Typography>
);

/**
 * デスクトップ: そのまま group でインライン表示
 * モバイル: 「絞り込み」ボタン → Dialog 内に children を表示
 */
export const SchedulesFilterResponsive: React.FC<SchedulesFilterResponsiveProps> = ({
  children,
  inlineStackProps,
  dialogTitle = DEFAULT_DIALOG_TITLE,
  dialogDescription = DEFAULT_DIALOG_DESCRIPTION,
  compact = false,
}) => {
  const isSmall = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  if (!isSmall && !compact) {
    return (
      <Stack
        role="group"
        aria-label="スケジュールの絞り込み"
        data-testid={TESTIDS.SCHEDULES_FILTER_GROUP}
        direction="column"
        spacing={0.5}
        alignItems="flex-end"
        {...inlineStackProps}
      >
        {children}
      </Stack>
    );
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={handleOpen}
        aria-haspopup="dialog"
        data-testid={TESTIDS.SCHEDULES_FILTER_TOGGLE}
      >
        絞り込み
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="schedules-filter-dialog-title"
        fullWidth
        maxWidth="sm"
        data-testid={TESTIDS.SCHEDULES_FILTER_DIALOG}
      >
        <DialogTitle id="schedules-filter-dialog-title">{dialogTitle}</DialogTitle>
        <DialogContent dividers>
          <Stack
            role="group"
            aria-label="スケジュールの絞り込み"
            data-testid={TESTIDS.SCHEDULES_FILTER_GROUP}
            spacing={2}
            sx={{ mt: 0.5 }}
          >
            {dialogDescription}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SchedulesFilterResponsive;
