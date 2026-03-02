// ---------------------------------------------------------------------------
// InterventionPickerPanel — 手順書から引用可能な介入方法ピッカー
// 支援記録に1タップで介入方法を引用する
// ---------------------------------------------------------------------------
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';
import { useMemo, useState } from 'react';

import type { InterventionMethod, SupportCategory, SupportScene } from '../ibdTypes';
import { extractInterventionMethods, SUPPORT_CATEGORY_CONFIG } from '../ibdTypes';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type InterventionPickerPanelProps = {
  /** 手順書の場面一覧 */
  scenes: SupportScene[];
  /** 選択時コールバック */
  onSelect: (method: InterventionMethod) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InterventionPickerPanel: FC<InterventionPickerPanelProps> = ({ scenes, onSelect }) => {
  const methods = useMemo(() => extractInterventionMethods(scenes), [scenes]);
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | 'all'>('all');

  const filtered = selectedCategory === 'all'
    ? methods
    : methods.filter((m) => m.category === selectedCategory);

  const categories = Object.entries(SUPPORT_CATEGORY_CONFIG) as [SupportCategory, typeof SUPPORT_CATEGORY_CONFIG[SupportCategory]][];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }} data-testid="intervention-picker">
      {/* カテゴリフィルター */}
      <Stack direction="row" spacing={1} sx={{ p: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Chip
          label="すべて"
          size="small"
          variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
          onClick={() => setSelectedCategory('all')}
        />
        {categories.map(([key, cfg]) => (
          <Chip
            key={key}
            label={cfg.label}
            size="small"
            variant={selectedCategory === key ? 'filled' : 'outlined'}
            onClick={() => setSelectedCategory(key)}
            sx={{
              borderColor: cfg.color,
              ...(selectedCategory === key && { bgcolor: cfg.bgColor, color: cfg.color, fontWeight: 600 }),
            }}
          />
        ))}
      </Stack>

      {/* 介入方法リスト */}
      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
        {filtered.length > 0 ? (
          <List dense disablePadding>
            {filtered.map((method) => {
              const cfg = SUPPORT_CATEGORY_CONFIG[method.category];
              return (
                <ListItemButton
                  key={method.id}
                  onClick={() => onSelect(method)}
                  sx={{
                    borderLeft: 4,
                    borderLeftColor: cfg.color,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  data-testid={`intervention-${method.id}`}
                >
                  <ListItemText
                    primary={method.label}
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {cfg.label} | ステップ #{method.sourceStepOrder}
                      </Typography>
                    }
                  />
                  <Chip label="引用" size="small" color="primary" variant="outlined" />
                </ListItemButton>
              );
            })}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            該当する介入方法がありません
          </Typography>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1, textAlign: 'right' }}>
        {methods.length}件の介入方法（{filtered.length}件表示中）
      </Typography>
    </Paper>
  );
};

export default InterventionPickerPanel;
