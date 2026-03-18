import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { useHandoff } from '../hooks/useHandoff';
import type { CreateHandoffInput } from '@/domain/HandoffRepository';
import { toast } from 'react-hot-toast';

export type HandoffComposerDialogProps = {
  open: boolean;
  onClose: () => void;
  targetDate: string;
  onSaved: () => void;
};

export const HandoffComposerDialog: React.FC<HandoffComposerDialogProps> = ({
  open,
  onClose,
  targetDate,
  onSaved
}) => {
  const { createHandoff } = useHandoff();
  const [formData, setFormData] = useState<Partial<CreateHandoffInput>>({
    targetDate,
    priority: 'normal',
    userId: '',
    content: '',
    reporterName: ''
  });

  const isFormValid = !!formData.content && !!formData.reporterName;

  const handleSave = async () => {
    if (!isFormValid) return;

    try {
      await createHandoff({
        targetDate: formData.targetDate || targetDate,
        priority: formData.priority as 'normal' | 'high' | 'emergency',
        content: formData.content!,
        reporterName: formData.reporterName!,
        userId: formData.userId || '',
        recordedAt: new Date().toISOString()
      });
      toast.success('申し送りを追加しました');
      onSaved();
      onClose();
    } catch {
      toast.error('保存に失敗しました');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>申し送り追加</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="normal" size="small">
          <TextField
            label="対象者名（任意）"
            value={formData.userId}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            size="small"
            placeholder="対象の利用者名など"
          />
        </FormControl>
        <FormControl fullWidth margin="normal" size="small">
          <InputLabel>優先度</InputLabel>
          <Select
            value={formData.priority || 'normal'}
            label="優先度"
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as CreateHandoffInput['priority'] })}
          >
            <MenuItem value="normal">通常</MenuItem>
            <MenuItem value="high">重要</MenuItem>
            <MenuItem value="emergency">緊急</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal" size="small">
          <TextField
            label="記録者名"
            value={formData.reporterName}
            onChange={(e) => setFormData({ ...formData, reporterName: e.target.value })}
            size="small"
            required
          />
        </FormControl>
        <FormControl fullWidth margin="normal" size="small">
          <TextField
            label="本文"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            multiline
            rows={4}
            size="small"
            required
          />
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isFormValid}>保存</Button>
      </DialogActions>
    </Dialog>
  );
};
