// ---------------------------------------------------------------------------
// SupportPlanTab — 「支援計画書」タブ
//
// SupportStepTemplate[] を timeSlot 順で表示する。
// ---------------------------------------------------------------------------
import type { SupportStepTemplate } from '@/domain/support/step-templates';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

interface SupportPlanTabProps {
  templates: SupportStepTemplate[];
  isLoading: boolean;
}

/** カテゴリ → アクセントカラー */
const categoryColor = (category: string): string => {
  if (category.includes('朝') || category.includes('準備')) return 'info.light';
  if (category.includes('活動') || category.includes('AM') || category.includes('PM')) return 'success.light';
  if (category.includes('昼食') || category.includes('休憩')) return 'warning.light';
  if (category.includes('終了') || category.includes('振り返り')) return 'secondary.light';
  return 'grey.200';
};

export const SupportPlanTab: React.FC<SupportPlanTabProps> = ({ templates, isLoading }) => {
  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          支援手順を読み込んでいます…
        </Typography>
      </Box>
    );
  }

  if (templates.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          支援手順が登録されていません
        </Typography>
        <Typography variant="body2" color="text.disabled">
          「支援手順マスタ」からテンプレートを作成してください。
        </Typography>
      </Box>
    );
  }

  const sorted = [...templates].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2 }}>
      {sorted.map((template) => (
        <Paper
          key={template.id}
          elevation={2}
          sx={{
            borderLeft: 6,
            borderColor: categoryColor(template.category),
            p: 3,
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Typography sx={{ fontSize: 20 }}>
              {template.iconEmoji ?? '📋'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
              {template.stepTitle}
            </Typography>
            <Chip
              icon={<AccessTimeIcon />}
              label={template.timeSlot}
              size="small"
              variant="outlined"
            />
            <Chip
              label={template.category}
              size="small"
              color={template.isRequired ? 'primary' : 'default'}
              variant={template.isRequired ? 'filled' : 'outlined'}
            />
          </Box>

          {/* Description */}
          {template.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {template.description}
            </Typography>
          )}

          {/* Two-column: targetBehavior / supportMethod */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' },
              gap: { xs: 2, md: 3 },
              mt: 1,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 0.5 }}>
                🧑 本人の動き
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {template.targetBehavior}
              </Typography>
            </Box>
            <Box sx={{ display: { xs: 'none', md: 'block' }, width: 1, bgcolor: 'divider' }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'success.dark', mb: 0.5 }}>
                👥 支援者の動き
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {template.supportMethod}
              </Typography>
            </Box>
          </Box>

          {/* Precautions */}
          {template.precautions && (
            <Typography
              variant="body2"
              sx={{ mt: 2, color: 'warning.dark', fontStyle: 'italic' }}
            >
              ⚠ {template.precautions}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  );
};
