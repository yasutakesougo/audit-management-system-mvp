import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';
import PreviewIcon from '@mui/icons-material/Preview';
import SaveIcon from '@mui/icons-material/Save';
import TimeIcon from '@mui/icons-material/AccessTime';
import WorkIcon from '@mui/icons-material/Work';
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
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';
import { SupportStepTemplate } from '../../domain/support/step-templates';

interface SupportStepTemplateFormProps {
  template?: SupportStepTemplate;
  onSave?: (template: SupportStepTemplate) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

export const SupportStepTemplateForm: React.FC<SupportStepTemplateFormProps> = ({
  template,
  onSave,
  onCancel,
  isEditing = false
}) => {
  const [formData, setFormData] = useState<Partial<SupportStepTemplate>>({
    stepTitle: template?.stepTitle || '',
    timeSlot: template?.timeSlot,
    category: template?.category,
    description: template?.description || '',
    targetBehavior: template?.targetBehavior || '',
    supportMethod: template?.supportMethod || '',
    precautions: template?.precautions || '',
    duration: template?.duration || 5,
    importance: template?.importance || '推奨',
    isRequired: template?.isRequired || false,
    iconEmoji: template?.iconEmoji || '📋',
    ...template
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // バリデーション
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.stepTitle?.trim()) {
      newErrors.stepTitle = '手順名は必須です';
    }

    if (!formData.timeSlot?.trim()) {
      newErrors.timeSlot = '実施時間帯は必須です';
    }

    if (!formData.category) {
      newErrors.category = 'カテゴリは必須です';
    }

    if (!formData.description?.trim()) {
      newErrors.description = '説明は必須です';
    }

    if (!formData.targetBehavior?.trim()) {
      newErrors.targetBehavior = '目標とする行動は必須です';
    }

    if (!formData.supportMethod?.trim()) {
      newErrors.supportMethod = '支援方法は必須です';
    }

    if (!formData.duration || formData.duration <= 0) {
      newErrors.duration = '想定時間は1分以上で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = (field: keyof SupportStepTemplate) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));

    // エラーをクリア
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSwitchChange = (field: keyof SupportStepTemplate) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: event.target.checked }));
  };

  const handleSave = () => {
    if (validateForm()) {
      const templateData: SupportStepTemplate = {
        id: template?.id || `step-${Date.now()}`,
        stepTitle: formData.stepTitle!,
        timeSlot: formData.timeSlot!,
        category: formData.category!,
        description: formData.description!,
        targetBehavior: formData.targetBehavior!,
        supportMethod: formData.supportMethod!,
        precautions: formData.precautions || '',
        duration: formData.duration!,
        importance: formData.importance!,
        isRequired: formData.isRequired!,
        iconEmoji: formData.iconEmoji || '📋',
      };
      onSave?.(templateData);
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case '必須': return 'error';
      case '推奨': return 'warning';
      case '任意': return 'info';
      default: return 'default';
    }
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
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
      'その他': '#f5f5f5'
    };
    return colorMap[category || ''] || '#f5f5f5';
  };

  if (previewMode) {
    return (
      <Box>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5">プレビュー</Typography>
              <Button
                startIcon={<CancelIcon />}
                onClick={() => setPreviewMode(false)}
              >
                編集に戻る
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* プレビュー表示 */}
        <Card
          sx={{
            borderLeft: `4px solid ${getCategoryColor(formData.category || '')}`,
            maxWidth: 400,
            mx: 'auto'
          }}
          elevation={3}
        >
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: 'primary.main' }}>
                {formData.iconEmoji || '📋'}
              </Avatar>
              <Box>
                <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                  {formData.stepTitle || '（手順名未入力）'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.timeSlot || '（時間帯未入力）'}
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
              {formData.category && (
                <Chip
                  label={formData.category}
                  size="small"
                  sx={{
                    bgcolor: getCategoryColor(formData.category),
                    color: 'text.primary'
                  }}
                />
              )}
              {formData.importance && (
                <Chip
                  label={formData.importance}
                  size="small"
                  color={getImportanceColor(formData.importance) as 'error' | 'warning' | 'info' | 'default'}
                />
              )}
              <Chip
                icon={<TimeIcon />}
                label={`${formData.duration || 0}分`}
                size="small"
                variant="outlined"
              />
              {formData.isRequired && (
                <Chip
                  label="必須"
                  size="small"
                  variant="outlined"
                  color="error"
                />
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary" mb={2}>
              {formData.description || '（説明未入力）'}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box mb={2}>
              <Box display="flex" alignItems="center" mb={1}>
                <PersonIcon sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="primary.main">
                  目標とする行動
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {formData.targetBehavior || '（目標行動未入力）'}
              </Typography>
            </Box>

            <Box mb={2}>
              <Box display="flex" alignItems="center" mb={1}>
                <WorkIcon sx={{ fontSize: 16, mr: 0.5, color: 'secondary.main' }} />
                <Typography variant="subtitle2" color="secondary.main">
                  職員の支援方法
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {formData.supportMethod || '（支援方法未入力）'}
              </Typography>
            </Box>

            {formData.precautions && (
              <Box>
                <Typography variant="subtitle2" color="warning.main" sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                  ⚠️ 注意・配慮事項
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  {formData.precautions}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Box mt={3} textAlign="center">
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{ mr: 2 }}
          >
            保存
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<CancelIcon />}
            onClick={onCancel}
          >
            キャンセル
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5">
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
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          入力内容を確認してください。必須項目が未入力です。
        </Alert>
      )}

      {/* 基本情報 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={3}>基本情報</Typography>

          <Stack spacing={3}>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                label="手順名"
                value={formData.stepTitle}
                onChange={handleInputChange('stepTitle')}
                error={!!errors.stepTitle}
                helperText={errors.stepTitle}
                required
                sx={{ flex: 2 }}
              />
              <TextField
                label="アイコン絵文字"
                value={formData.iconEmoji}
                onChange={handleInputChange('iconEmoji')}
                placeholder="📋"
                sx={{ flex: 1 }}
              />
            </Box>

            <Box display="flex" gap={2}>
              <FormControl fullWidth error={!!errors.timeSlot} required>
                <InputLabel>実施時間帯</InputLabel>
                <Select
                  value={formData.timeSlot || ''}
                  label="実施時間帯"
                  onChange={handleInputChange('timeSlot')}
                >
                  <MenuItem value="09:30-10:30">09:30-10:30</MenuItem>
                  <MenuItem value="10:30-11:30">10:30-11:30</MenuItem>
                  <MenuItem value="11:30-12:30">11:30-12:30</MenuItem>
                  <MenuItem value="12:30-13:30">12:30-13:30</MenuItem>
                  <MenuItem value="13:30-14:30">13:30-14:30</MenuItem>
                  <MenuItem value="14:30-15:30">14:30-15:30</MenuItem>
                  <MenuItem value="15:30-16:00">15:30-16:00</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth error={!!errors.category} required>
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={formData.category || ''}
                  label="カテゴリ"
                  onChange={handleInputChange('category')}
                >
                  <MenuItem value="朝の準備">朝の準備</MenuItem>
                  <MenuItem value="健康確認">健康確認</MenuItem>
                  <MenuItem value="活動準備">活動準備</MenuItem>
                  <MenuItem value="AM活動">AM活動</MenuItem>
                  <MenuItem value="昼食準備">昼食準備</MenuItem>
                  <MenuItem value="昼食">昼食</MenuItem>
                  <MenuItem value="休憩">休憩</MenuItem>
                  <MenuItem value="PM活動">PM活動</MenuItem>
                  <MenuItem value="終了準備">終了準備</MenuItem>
                  <MenuItem value="振り返り">振り返り</MenuItem>
                  <MenuItem value="その他">その他</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                type="number"
                label="想定時間（分）"
                value={formData.duration}
                onChange={handleInputChange('duration')}
                error={!!errors.duration}
                helperText={errors.duration}
                inputProps={{ min: 1, max: 180 }}
              />

              <FormControl fullWidth>
                <InputLabel>重要度</InputLabel>
                <Select
                  value={formData.importance}
                  label="重要度"
                  onChange={handleInputChange('importance')}
                >
                  <MenuItem value="必須">必須</MenuItem>
                  <MenuItem value="推奨">推奨</MenuItem>
                  <MenuItem value="任意">任意</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isRequired}
                  onChange={handleSwitchChange('isRequired')}
                />
              }
              label="必須手順として設定する"
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="説明"
              value={formData.description}
              onChange={handleInputChange('description')}
              error={!!errors.description}
              helperText={errors.description}
              required
            />
          </Stack>
        </CardContent>
      </Card>

      {/* 行動・支援内容 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={3}>行動・支援内容</Typography>

          <Stack spacing={3}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="目標とする行動"
              value={formData.targetBehavior}
              onChange={handleInputChange('targetBehavior')}
              error={!!errors.targetBehavior}
              helperText={errors.targetBehavior || '利用者様にどのような行動を取ってもらいたいかを具体的に記載'}
              required
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="職員の支援方法"
              value={formData.supportMethod}
              onChange={handleInputChange('supportMethod')}
              error={!!errors.supportMethod}
              helperText={errors.supportMethod || '職員がどのように支援するかを具体的に記載'}
              required
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="注意・配慮事項"
              value={formData.precautions}
              onChange={handleInputChange('precautions')}
              helperText="支援時の注意点や配慮すべき事項があれば記載（任意）"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* アクションボタン */}
      <Box textAlign="center" mb={4}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          sx={{ mr: 2 }}
        >
          保存
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<CancelIcon />}
          onClick={onCancel}
        >
          キャンセル
        </Button>
      </Box>
    </Box>
  );
};