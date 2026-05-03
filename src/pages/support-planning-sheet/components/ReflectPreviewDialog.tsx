import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { alpha } from '@mui/material/styles';
import type { ReflectPreview } from '@/domain/isp/schema';

interface ReflectPreviewDialogProps {
  open: boolean;
  preview?: ReflectPreview;
  onClose: () => void;
  onConfirm: () => void;
}

export const ReflectPreviewDialog: React.FC<ReflectPreviewDialogProps> = ({
  open,
  preview,
  onClose,
  onConfirm,
}) => {
  if (!preview) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, p: 1 }
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        支援計画への反映プレビュー
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          氷山分析の結果に基づき、以下の内容を支援計画のアセスメント欄へ追加します。内容を確認してください。
        </Typography>

        <Stack spacing={2}>
          {preview.changes.map((change, idx) => (
            <Box 
              key={idx}
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha('#f5f5f5', 0.5)
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleRoundedIcon fontSize="small" color="primary" />
                {change.label}
              </Typography>
              
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.disabled" display="block">現状</Typography>
                  <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                    {change.before}
                  </Typography>
                </Box>
                <ArrowForwardRoundedIcon color="disabled" fontSize="small" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="primary" fontWeight={700} display="block">反映後</Typography>
                  <Typography variant="body2" fontWeight={600} color="primary.main">
                    {change.after}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Box 
          sx={{ 
            mt: 3, 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: alpha('#0288d1', 0.05),
            border: '1px solid',
            borderColor: alpha('#0288d1', 0.2),
            display: 'flex',
            gap: 1.5
          }}
        >
          <InfoOutlinedIcon fontSize="small" color="info" sx={{ mt: 0.3 }} />
          <Typography variant="caption" color="info.main" sx={{ lineHeight: 1.5 }}>
            この操作ではまだ保存されません。反映後、支援計画の内容を確認してから「保存」ボタンを押してください。
            また、既に同じ内容が登録されている場合は、重複して追加されることはありません。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ fontWeight: 700 }}>
          キャンセル
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="primary"
          sx={{ 
            borderRadius: 2, 
            px: 3,
            fontWeight: 700,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' }
          }}
        >
          反映する
        </Button>
      </DialogActions>
    </Dialog>
  );
};
