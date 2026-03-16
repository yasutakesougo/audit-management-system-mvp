/**
 * ImportPreviewDialog — 特性アンケート取込の差分プレビューダイアログ
 *
 * 取込ボタン押下でフォームに即反映せず、まずこのダイアログで
 * 「どこに何が入るか」を確認してから確定する。
 */
import React from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';

import type { ImportPreviewItem, ImportPreviewResult } from '../buildImportPreview';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: ImportPreviewResult | null;
  /** 回答者情報（表示用） */
  responderInfo?: {
    name: string;
    relation?: string;
    fillDate?: string;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportPreviewDialog: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  preview,
  responderInfo,
}) => {
  if (!preview) return null;

  const { items, summary } = preview;

  // セクションごとにグループ化
  const grouped = React.useMemo(() => {
    const map = new Map<string, ImportPreviewItem[]>();
    for (const item of items) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxHeight: '80vh' } }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <SupportAgentRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            取込プレビュー
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {/* ── 回答者情報 ── */}
          {responderInfo && (
            <Alert severity="info" variant="outlined" icon={false}>
              <Typography variant="body2">
                <strong>回答元:</strong> {responderInfo.name}
                {responderInfo.relation ? `（${responderInfo.relation}）` : ''}
                {responderInfo.fillDate
                  ? ` — ${new Date(responderInfo.fillDate).toLocaleDateString('ja-JP')}`
                  : ''}
              </Typography>
            </Alert>
          )}

          {/* ── サマリー ── */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<AddCircleOutlineRoundedIcon />}
              label={`新規入力 ${summary.newCount}項目`}
              color="primary"
              size="small"
              variant="outlined"
            />
            <Chip
              icon={<EditNoteRoundedIcon />}
              label={`追記 ${summary.appendCount}項目`}
              color="warning"
              size="small"
              variant="outlined"
            />
            <Chip
              label={`合計 ${summary.totalAffected}項目に反映`}
              size="small"
              variant="filled"
              color="default"
            />
          </Stack>

          {/* ── セクション別プレビュー ── */}
          {grouped.map(([section, sectionItems], sIdx) => (
            <Box key={section}>
              {sIdx > 0 && <Divider sx={{ my: 1 }} />}
              <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1 }}>
                {section}
              </Typography>
              <Stack spacing={1.5}>
                {sectionItems.map((item) => (
                  <Box
                    key={item.fieldKey}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: item.action === 'new' ? 'primary.50' : 'warning.50',
                      border: '1px solid',
                      borderColor: item.action === 'new' ? 'primary.200' : 'warning.200',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {item.fieldLabel}
                      </Typography>
                      <Chip
                        label={item.action === 'new' ? '新規入力' : '追記'}
                        size="small"
                        color={item.action === 'new' ? 'primary' : 'warning'}
                        variant="outlined"
                        sx={{ height: 20, '& .MuiChip-label': { px: 0.8, fontSize: '0.7rem' } }}
                      />
                    </Stack>

                    {item.action === 'append' && item.currentValue && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          mb: 0.5,
                          fontStyle: 'italic',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        既存: {item.currentValue.length > 60
                          ? `${item.currentValue.slice(0, 60)}…`
                          : item.currentValue}
                      </Typography>
                    )}

                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-line',
                        bgcolor: 'background.paper',
                        p: 1,
                        borderRadius: 0.5,
                        maxHeight: 120,
                        overflow: 'auto',
                      }}
                    >
                      {item.incomingValue.length > 200
                        ? `${item.incomingValue.slice(0, 200)}…`
                        : item.incomingValue}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}

          {items.length === 0 && (
            <Alert severity="info" variant="outlined">
              取り込むデータがありません。アンケートの回答内容が空の可能性があります。
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          キャンセル
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={items.length === 0}
          startIcon={<SupportAgentRoundedIcon />}
        >
          この内容で取り込む
        </Button>
      </DialogActions>
    </Dialog>
  );
};
