import TimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FilterIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Fab from '@mui/material/Fab';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';
import {
    SupportStepTemplate,
    supportCategoryValues,
    supportImportanceValues,
} from '../../domain/support/step-templates';

// ─── Shared color maps (Form と統一) ──────
const IMPORTANCE_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  '必須': 'error',
  '推奨': 'warning',
  '任意': 'info',
};

const CATEGORY_BG: Record<string, string> = {
  '朝の準備': '#f3e5f5',
  '健康確認': '#e8f5e8',
  '活動準備': '#fff3e0',
  'AM活動': '#e1f5fe',
  '昼食準備': '#fff8e1',
  '昼食': '#fff8e1',
  '休憩': '#f1f8e9',
  'PM活動': '#fce4ec',
  '終了準備': '#e0f2f1',
  '振り返り': '#f9fbe7',
  'その他': '#f5f5f5',
};

// ─── Types ────────────────────────────────
interface SupportStepTemplateListProps {
  templates?: SupportStepTemplate[];
  onEdit?: (template: SupportStepTemplate) => void;
  onDelete?: (templateId: string) => void;
  onAdd?: () => void;
}

// ─── Component ────────────────────────────
export const SupportStepTemplateList: React.FC<SupportStepTemplateListProps> = ({
  templates = [],
  onEdit,
  onDelete,
  onAdd,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return templates.filter((t) => {
      if (q && ![t.stepTitle, t.targetBehavior, t.supportMethod].some((s) => s.toLowerCase().includes(q)))
        return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (importanceFilter && t.importance !== importanceFilter) return false;
      return true;
    });
  }, [templates, searchQuery, categoryFilter, importanceFilter]);

  return (
    <Box>
      {/* ── フィルターバー ── */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr 1fr auto' }}
        gap={2}
        mb={3}
      >
        <TextField
          size="small"
          label="検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          placeholder="手順名・本人の動き・支援者の動きで検索"
        />
        <FormControl size="small">
          <InputLabel>カテゴリ</InputLabel>
          <Select value={categoryFilter} label="カテゴリ" onChange={(e) => setCategoryFilter(e.target.value)}>
            <MenuItem value="">すべて</MenuItem>
            {supportCategoryValues.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>重要度</InputLabel>
          <Select value={importanceFilter} label="重要度" onChange={(e) => setImportanceFilter(e.target.value)}>
            <MenuItem value="">すべて</MenuItem>
            {supportImportanceValues.map((i) => (
              <MenuItem key={i} value={i}>
                {i}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" alignSelf="center" textAlign="center" whiteSpace="nowrap">
          {filtered.length} 件
        </Typography>
      </Box>

      {/* ── カード一覧 ── */}
      <Stack spacing={2}>
        {filtered.map((template) => (
          <Card
            key={template.id}
            sx={{
              borderLeft: `4px solid ${CATEGORY_BG[template.category] || '#ccc'}`,
              '&:hover': { boxShadow: 4, transition: 'box-shadow 0.2s' },
            }}
            elevation={1}
          >
            <CardContent sx={{ pb: '12px !important' }}>
              {/* ── Row 1: Header + Actions ── */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 16 }}>
                    {template.iconEmoji || '📋'}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600} lineHeight={1.3}>
                      {template.stepTitle}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {template.timeSlot}
                      </Typography>
                      <Chip
                        label={template.category}
                        size="small"
                        sx={{ height: 20, fontSize: '0.7rem', bgcolor: CATEGORY_BG[template.category] }}
                      />
                      <Chip
                        label={template.importance}
                        size="small"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                        color={IMPORTANCE_COLOR[template.importance] ?? 'default'}
                      />
                      <Chip
                        icon={<TimeIcon sx={{ fontSize: '12px !important' }} />}
                        label={`${template.duration}分`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Stack>
                  </Box>
                </Box>

                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="編集">
                    <IconButton size="small" onClick={() => onEdit?.(template)} color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={() => onDelete?.(template.id)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>

              {/* ── Row 2: Split View — 本人の動き → 支援者の動き ── */}
              <Box
                display="grid"
                gridTemplateColumns="1fr auto 1fr"
                gap={1}
                alignItems="stretch"
              >
                {/* 左: 本人の動き */}
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, borderColor: 'primary.light', borderRadius: 1.5 }}
                >
                  <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                    <PersonIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    <Typography variant="caption" color="primary.main" fontWeight={700}>
                      本人の動き
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                  >
                    {template.targetBehavior || '—'}
                  </Typography>
                </Paper>

                {/* 矢印 */}
                <Box display="flex" alignItems="center">
                  <ArrowForwardIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </Box>

                {/* 右: 支援者の動き */}
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, borderColor: 'secondary.light', borderRadius: 1.5 }}
                >
                  <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                    <SupportAgentIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
                    <Typography variant="caption" color="secondary.main" fontWeight={700}>
                      支援者の動き
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                  >
                    {template.supportMethod || '—'}
                  </Typography>
                </Paper>
              </Box>

              {/* ── Row 3: 注意事項（あれば） ── */}
              {template.precautions && (
                <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                  <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                  <Typography variant="caption" color="warning.main">
                    {template.precautions}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* ── 0件表示 ── */}
      {filtered.length === 0 && (
        <Box textAlign="center" py={6}>
          <FilterIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            該当するテンプレートがありません
          </Typography>
        </Box>
      )}

      {/* ── FAB ── */}
      <Fab
        color="primary"
        aria-label="新規テンプレート作成"
        onClick={onAdd}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};
