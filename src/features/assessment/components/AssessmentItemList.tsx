import type { AssessmentItem, IcfCategory } from '@/features/assessment/domain/types';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

type Props = {
  items: AssessmentItem[];
  onChange: (next: AssessmentItem[]) => void;
};

const CATEGORY_LABELS: Record<IcfCategory, string> = {
  body: '心身機能・身体',
  activity: '活動・参加',
  environment: '環境因子',
  personal: '個人因子',
};

const STATUS_CONFIG = {
  strength: { label: '強み・得意', color: 'success' as const },
  neutral: { label: '特徴', color: 'default' as const },
  challenge: { label: '課題・配慮', color: 'warning' as const },
};

export const AssessmentItemList: React.FC<Props> = ({ items, onChange }) => {
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState<Omit<AssessmentItem, 'id'>>({
    category: 'activity',
    topic: '',
    status: 'neutral',
    description: '',
  });

  const handleAdd = () => {
    const item: AssessmentItem = {
      ...newItem,
      id: `item-${Date.now()}`,
    };
    onChange([...items, item]);
    setOpen(false);
    setNewItem({ category: 'activity', topic: '', status: 'neutral', description: '' });
  };

  const handleDelete = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight="bold">
          特性・ICFリスト
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          項目追加
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }
        }}
      >
        {items.length === 0 ? (
          <Box gridColumn="1 / -1">
            <Typography color="text.secondary" align="center" py={4}>
              登録された特性はありません
            </Typography>
          </Box>
        ) : (
          items.map((item) => (
            <Card variant="outlined" key={item.id}>
              <CardContent sx={{ position: 'relative', pb: 1 }}>
                <IconButton size="small" sx={{ position: 'absolute', top: 8, right: 8 }} onClick={() => handleDelete(item.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>

                <Box display="flex" gap={1} mb={1}>
                  <Chip label={CATEGORY_LABELS[item.category]} size="small" variant="outlined" />
                  <Chip label={STATUS_CONFIG[item.status].label} color={STATUS_CONFIG[item.status].color} size="small" />
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {item.topic}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>特性の追加</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <FormControl fullWidth size="small">
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={newItem.category}
                label="カテゴリ"
                onChange={(event) => setNewItem({ ...newItem, category: event.target.value as IcfCategory })}
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="項目名 (トピック)"
              placeholder="例: 睡眠、コミュニケーション、手先の動き"
              value={newItem.topic}
              onChange={(event) => setNewItem({ ...newItem, topic: event.target.value })}
              fullWidth
              size="small"
            />

            <FormControl fullWidth size="small">
              <InputLabel>評価</InputLabel>
              <Select
                value={newItem.status}
                label="評価"
                onChange={(event) => setNewItem({ ...newItem, status: event.target.value as AssessmentItem['status'] })}
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="詳細記述"
              placeholder="具体的な様子や配慮事項を入力"
              value={newItem.description}
              onChange={(event) => setNewItem({ ...newItem, description: event.target.value })}
              multiline
              minRows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!newItem.topic}>
            追加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
