import TimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';
import PreviewIcon from '@mui/icons-material/Preview';
import SaveIcon from '@mui/icons-material/Save';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';
import {
    SupportStepTemplate,
    standardTimeSlotValues,
    supportCategoryValues,
    supportImportanceValues,
} from '@/domain/support/step-templates';

// ─── Types ────────────────────────────────
interface SupportStepTemplateFormProps {
  template?: SupportStepTemplate;
  onSave?: (template: SupportStepTemplate) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

// ─── Color Helpers ────────────────────────
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

// ─── Component ────────────────────────────
export const SupportStepTemplateForm: React.FC<SupportStepTemplateFormProps> = ({
  template,
  onSave,
  onCancel,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<Partial<SupportStepTemplate>>({
    stepTitle: '',
    timeSlot: undefined,
    category: undefined,
    description: '',
    targetBehavior: '',
    supportMethod: '',
    precautions: '',
    duration: 60,
    importance: '必須',
    isRequired: true,
    iconEmoji: '📋',
    ...template,
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Validation ──
  const validateForm = useCallback(() => {
    const e: Record<string, string> = {};
    if (!formData.stepTitle?.trim()) e.stepTitle = '手順名は必須です';
    if (!formData.timeSlot?.trim()) e.timeSlot = '時間帯は必須です';
    if (!formData.category) e.category = 'カテゴリは必須です';
    if (!formData.targetBehavior?.trim()) e.targetBehavior = '本人の動きは必須です';
    if (!formData.supportMethod?.trim()) e.supportMethod = '支援者の動きは必須です';
    if (!formData.duration || formData.duration <= 0) e.duration = '1分以上';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [formData]);

  // ── Handlers ──
  const handleChange =
    (field: keyof SupportStepTemplate) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }) => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    };

  const handleSwitch = (field: keyof SupportStepTemplate) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.checked }));
  };

  const handleSave = () => {
    if (!validateForm()) return;
    onSave?.({
      id: template?.id || `step-${Date.now()}`,
      stepTitle: formData.stepTitle!,
      timeSlot: formData.timeSlot!,
      category: formData.category!,
      description: formData.description || formData.targetBehavior || '',
      targetBehavior: formData.targetBehavior!,
      supportMethod: formData.supportMethod!,
      precautions: formData.precautions || '',
      duration: formData.duration!,
      importance: formData.importance!,
      isRequired: formData.isRequired!,
      iconEmoji: formData.iconEmoji || '📋',
    });
  };

  // ═══════════════════════════════════════════
  // Preview Mode
  // ═══════════════════════════════════════════
  if (previewMode) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">プレビュー</Typography>
          <Button startIcon={<CancelIcon />} onClick={() => setPreviewMode(false)}>
            編集に戻る
          </Button>
        </Box>

        <Card
          sx={{
            borderLeft: `4px solid ${CATEGORY_BG[formData.category || ''] || '#ccc'}`,
            maxWidth: 600,
            mx: 'auto',
          }}
          elevation={3}
        >
          <CardContent>
            {/* Header */}
            <Box display="flex" alignItems="center" mb={2}>
              <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: 'primary.main' }}>
                {formData.iconEmoji || '📋'}
              </Avatar>
              <Box flex={1}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formData.stepTitle || '（未入力）'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.timeSlot || '（未入力）'}
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
              {formData.category && (
                <Chip label={formData.category} size="small" sx={{ bgcolor: CATEGORY_BG[formData.category] }} />
              )}
              {formData.importance && (
                <Chip label={formData.importance} size="small" color={IMPORTANCE_COLOR[formData.importance] ?? 'default'} />
              )}
              <Chip icon={<TimeIcon />} label={`${formData.duration || 0}分`} size="small" variant="outlined" />
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* ── Split View Preview ── */}
            <Box
              display="grid"
              gridTemplateColumns="1fr auto 1fr"
              gap={2}
              alignItems="start"
            >
              {/* 左: 本人の動き */}
              <Paper
                variant="outlined"
                sx={{ p: 2, borderColor: 'primary.light', borderRadius: 2 }}
              >
                <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                  <PersonIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
                    本人の動き
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {formData.targetBehavior || '（未入力）'}
                </Typography>
              </Paper>

              {/* 矢印コネクタ */}
              <Box display="flex" alignItems="center" pt={3}>
                <ArrowForwardIcon sx={{ color: 'text.disabled', fontSize: 28 }} />
              </Box>

              {/* 右: 支援者の動き */}
              <Paper
                variant="outlined"
                sx={{ p: 2, borderColor: 'secondary.light', borderRadius: 2 }}
              >
                <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                  <SupportAgentIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                  <Typography variant="subtitle2" color="secondary.main" fontWeight={700}>
                    支援者の動き
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {formData.supportMethod || '（未入力）'}
                </Typography>
              </Paper>
            </Box>

            {/* 注意事項 */}
            {formData.precautions && (
              <Box mt={2}>
                <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                  <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                  <Typography variant="subtitle2" color="warning.main">
                    注意・配慮事項
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {formData.precautions}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Box mt={3} textAlign="center">
          <Button variant="contained" size="large" startIcon={<SaveIcon />} onClick={handleSave} sx={{ mr: 2 }}>
            保存
          </Button>
          <Button variant="outlined" size="large" startIcon={<CancelIcon />} onClick={onCancel}>
            キャンセル
          </Button>
        </Box>
      </Box>
    );
  }

  // ═══════════════════════════════════════════
  // Edit Mode
  // ═══════════════════════════════════════════
  return (
    <Box>
      {/* ── Header ── */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          {isEditing ? '支援手順テンプレート編集' : '支援手順テンプレート新規作成'}
        </Typography>
        <Button
          startIcon={<PreviewIcon />}
          onClick={() => setPreviewMode(true)}
          disabled={!formData.stepTitle || !formData.timeSlot}
        >
          プレビュー
        </Button>
      </Box>

      {/* ── Errors ── */}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          必須項目を確認してください
        </Alert>
      )}

      {/* ══════════════════════════════════════ */}
      {/* Section 1: 基本情報（コンパクト） */}
      {/* ══════════════════════════════════════ */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            📋 基本情報
          </Typography>

          <Box display="grid" gridTemplateColumns="2fr 1fr" gap={2} mb={2}>
            <TextField
              label="手順名"
              value={formData.stepTitle}
              onChange={handleChange('stepTitle')}
              error={!!errors.stepTitle}
              helperText={errors.stepTitle}
              required
              size="small"
            />
            <TextField
              label="絵文字"
              value={formData.iconEmoji}
              onChange={handleChange('iconEmoji')}
              placeholder="📋"
              size="small"
            />
          </Box>

          <Box display="grid" gridTemplateColumns="1fr 1fr 100px 100px" gap={2} mb={1}>
            <FormControl size="small" error={!!errors.timeSlot} required>
              <InputLabel>時間帯</InputLabel>
              <Select value={formData.timeSlot || ''} label="時間帯" onChange={handleChange('timeSlot')}>
                {standardTimeSlotValues.map((slot) => (
                  <MenuItem key={slot} value={slot}>
                    {slot}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" error={!!errors.category} required>
              <InputLabel>カテゴリ</InputLabel>
              <Select value={formData.category || ''} label="カテゴリ" onChange={handleChange('category')}>
                {supportCategoryValues.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              type="number"
              label="分"
              value={formData.duration}
              onChange={handleChange('duration')}
              error={!!errors.duration}
              inputProps={{ min: 1, max: 180 }}
              size="small"
            />

            <FormControl size="small">
              <InputLabel>重要度</InputLabel>
              <Select value={formData.importance || '必須'} label="重要度" onChange={handleChange('importance')}>
                {supportImportanceValues.map((imp) => (
                  <MenuItem key={imp} value={imp}>
                    {imp}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <FormControlLabel
            control={<Switch checked={formData.isRequired} onChange={handleSwitch('isRequired')} size="small" />}
            label={<Typography variant="body2">必須手順</Typography>}
          />
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════ */}
      {/* Section 2: 本人の動き ↔ 支援者の動き（Split View） */}
      {/* ══════════════════════════════════════ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            🤝 本人の動き → 支援者の動き
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            「本人がこう動くから、支援者はこう動く」— 因果関係を意識して記入してください
          </Typography>

          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr', md: '1fr auto 1fr' }}
            gap={2}
            alignItems="stretch"
          >
            {/* ── 左: 本人の動き ── */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderColor: 'primary.light',
                borderRadius: 2,
                borderWidth: 2,
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <PersonIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
                  本人の動き
                </Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={5}
                value={formData.targetBehavior}
                onChange={handleChange('targetBehavior')}
                error={!!errors.targetBehavior}
                helperText={errors.targetBehavior || '例: 手洗い、荷物をロッカーへ、提出物を職員へ'}
                required
                placeholder="利用者様にどのような行動を取ってもらいたいか"
                variant="outlined"
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
              />
            </Paper>

            {/* ── 矢印コネクタ ── */}
            <Box
              display={{ xs: 'none', md: 'flex' }}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
              gap={0.5}
            >
              <ArrowForwardIcon sx={{ color: 'action.active', fontSize: 32 }} />
              <Typography variant="caption" color="text.disabled" sx={{ writingMode: 'vertical-rl' }}>
                だから
              </Typography>
            </Box>

            {/* ── 右: 支援者の動き ── */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderColor: 'secondary.light',
                borderRadius: 2,
                borderWidth: 2,
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <SupportAgentIcon sx={{ color: 'secondary.main' }} />
                <Typography variant="subtitle2" color="secondary.main" fontWeight={700}>
                  支援者の動き
                </Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={5}
                value={formData.supportMethod}
                onChange={handleChange('supportMethod')}
                error={!!errors.supportMethod}
                helperText={errors.supportMethod || '例: 手洗いの声掛け、荷物整理のお手伝い'}
                required
                placeholder="職員がどのように支援するか"
                variant="outlined"
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
              />
            </Paper>
          </Box>

          {/* ── 注意・配慮事項 ── */}
          <Box mt={2}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="⚠️ 注意・配慮事項（任意）"
              value={formData.precautions}
              onChange={handleChange('precautions')}
              helperText="支援時の注意点や配慮すべき事項"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <Box textAlign="center" mb={4}>
        <Button variant="contained" size="large" startIcon={<SaveIcon />} onClick={handleSave} sx={{ mr: 2 }}>
          保存
        </Button>
        <Button variant="outlined" size="large" startIcon={<CancelIcon />} onClick={onCancel}>
          キャンセル
        </Button>
      </Box>
    </Box>
  );
};
