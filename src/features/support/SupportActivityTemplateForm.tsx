import {
    Person as PersonIcon,
    Preview as PreviewIcon,
    AccessTime as TimeIcon,
    Work as WorkIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { SupportActivityTemplate, SupportActivityTemplateZ } from '../../domain/support/types';

interface SupportActivityTemplateFormProps {
  open: boolean;
  template?: SupportActivityTemplate;
  onSave: (template: Omit<SupportActivityTemplate, 'id'>) => void;
  onCancel: () => void;
}

export const SupportActivityTemplateForm: React.FC<SupportActivityTemplateFormProps> = ({
  open,
  template,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Omit<SupportActivityTemplate, 'id'>>({
    specificTime: '',
    activityName: '',
    category: '朝の準備',
    description: '',
    userExpectedActions: '',
    staffSupportMethods: '',
    duration: 30,
    importance: '推奨',
    iconEmoji: '📋',
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // 編集時の初期値設定
  useEffect(() => {
    if (template) {
      setFormData({
        specificTime: template.specificTime,
        activityName: template.activityName,
        category: template.category,
        description: template.description,
        userExpectedActions: template.userExpectedActions,
        staffSupportMethods: template.staffSupportMethods,
        duration: template.duration,
        importance: template.importance,
        iconEmoji: template.iconEmoji || '📋',
      });
    } else {
      // 新規作成時はリセット
      setFormData({
        specificTime: '',
        activityName: '',
        category: '朝の準備',
        description: '',
        userExpectedActions: '',
        staffSupportMethods: '',
        duration: 30,
        importance: '推奨',
        iconEmoji: '📋',
      });
    }
    setValidationErrors([]);
    setShowPreview(false);
  }, [template, open]);

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    try {
      SupportActivityTemplateZ.omit({ id: true }).parse(formData);
      setValidationErrors([]);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((err: z.ZodIssue) => err.message);
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
  };

  const isEditing = Boolean(template);

  // 時間のプリセット
  const timePresets = [
    '9:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
  ];

  // 絵文字のプリセット
  const emojiPresets = [
    '📋', '🚌', '🏃', '🧼', '🍽️', '💪', '🎯', '👥', '📝', '🛠️',
    '🎨', '💼', '🏥', '🧘', '🎵', '📚', '🏆', '⚽', '🌟', '💡'
  ];

  const categoryOptions = [
    '通所・帰宅',
    '朝の準備',
    '健康確認',
    '活動準備',
    'AM活動',
    '昼食準備',
    '昼食',
    '休憩',
    'PM活動',
    '終了準備',
    '振り返り',
    'その他'
  ] as const;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {isEditing ? 'テンプレート編集' : '新規テンプレート作成'}
          </Typography>
          <Button
            startIcon={<PreviewIcon />}
            onClick={handlePreviewToggle}
            variant={showPreview ? "contained" : "outlined"}
            size="small"
          >
            {showPreview ? 'フォーム表示' : 'プレビュー表示'}
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" mb={1}>入力エラーがあります：</Typography>
            {validationErrors.map((error, index) => (
              <Typography key={index} variant="body2">• {error}</Typography>
            ))}
          </Alert>
        )}

        {showPreview ? (
          /* プレビュー表示 */
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Typography sx={{ fontSize: '2rem', mr: 2 }}>
                  {formData.iconEmoji}
                </Typography>
                <Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                    {formData.activityName || '活動名未入力'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formData.specificTime || '時間未入力'}
                  </Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={1} mb={2}>
                <Chip label={formData.category} size="small" color="primary" />
                <Chip label={formData.importance} size="small" color="secondary" />
                <Chip
                  icon={<TimeIcon />}
                  label={`${formData.duration}分`}
                  size="small"
                  variant="outlined"
                />
              </Stack>

              <Typography variant="body2" color="text.secondary" mb={3}>
                {formData.description || '説明未入力'}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box mb={2}>
                <Box display="flex" alignItems="center" mb={1}>
                  <PersonIcon sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="primary.main">
                    本人のやること
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {formData.userExpectedActions || '本人の行動未入力'}
                </Typography>
              </Box>

              <Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <WorkIcon sx={{ fontSize: 16, mr: 0.5, color: 'secondary.main' }} />
                  <Typography variant="subtitle2" color="secondary.main">
                    職員のやること
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {formData.staffSupportMethods || '職員の支援方法未入力'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          /* フォーム表示 */
          <Box>
            {/* 基本情報 */}
            <Typography variant="h6" mb={2} color="primary.main">
              基本情報
            </Typography>

            <Box display="flex" gap={2} mb={3} flexWrap="wrap">
              <Box flex={1} minWidth="200px">
                <FormControl fullWidth>
                  <InputLabel>開始時間</InputLabel>
                  <Select
                    value={formData.specificTime}
                    label="開始時間"
                    onChange={(e) => handleChange('specificTime', e.target.value)}
                  >
                    {timePresets.map(time => (
                      <MenuItem key={time} value={time}>{time}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box flex={1} minWidth="200px">
                <TextField
                  fullWidth
                  label="活動名"
                  value={formData.activityName}
                  onChange={(e) => handleChange('activityName', e.target.value)}
                  placeholder="例：朝の会、個別作業、昼食"
                  required
                />
              </Box>
            </Box>

            <Box display="flex" gap={2} mb={3} flexWrap="wrap">
              <Box flex={1} minWidth="200px">
                <FormControl fullWidth>
                  <InputLabel>カテゴリ</InputLabel>
                  <Select
                    value={formData.category}
                    label="カテゴリ"
                    onChange={(e) => handleChange('category', e.target.value)}
                  >
                    {categoryOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box flex={1} minWidth="200px">
                <FormControl fullWidth>
                  <InputLabel>重要度</InputLabel>
                  <Select
                    value={formData.importance}
                    label="重要度"
                    onChange={(e) => handleChange('importance', e.target.value)}
                  >
                    <MenuItem value="必須">必須</MenuItem>
                    <MenuItem value="推奨">推奨</MenuItem>
                    <MenuItem value="任意">任意</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* 時間とアイコン */}
            <Box display="flex" gap={3} mb={3} flexWrap="wrap">
              <Box flex={1} minWidth="300px">
                <Typography gutterBottom>所要時間（分）</Typography>
                <Box px={2}>
                  <Slider
                    value={formData.duration}
                    onChange={(_, value) => handleChange('duration', value as number)}
                    min={15}
                    max={180}
                    step={15}
                    marks={[
                      { value: 15, label: '15分' },
                      { value: 60, label: '60分' },
                      { value: 120, label: '120分' },
                      { value: 180, label: '180分' }
                    ]}
                    valueLabelDisplay="on"
                  />
                </Box>
              </Box>

              <Box flex={1} minWidth="300px">
                <Typography gutterBottom>アイコン絵文字</Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {emojiPresets.map(emoji => (
                    <Button
                      key={emoji}
                      variant={formData.iconEmoji === emoji ? "contained" : "outlined"}
                      onClick={() => handleChange('iconEmoji', emoji)}
                      sx={{ minWidth: 48, minHeight: 48, fontSize: '1.5rem' }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>

            {/* 説明 */}
            <Box mb={3}>
              <TextField
                fullWidth
                label="活動の説明"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="この活動の目的や内容を簡潔に説明してください"
                multiline
                rows={3}
                required
              />
            </Box>

            {/* 本人・職員のやること */}
            <Typography variant="h6" mb={2} color="primary.main">
              支援内容
            </Typography>

            <Box display="flex" gap={2} flexWrap="wrap">
              <Box flex={1} minWidth="300px">
                <TextField
                  fullWidth
                  label="本人のやること"
                  value={formData.userExpectedActions}
                  onChange={(e) => handleChange('userExpectedActions', e.target.value)}
                  placeholder="本人に期待される行動や参加方法を具体的に記述してください"
                  multiline
                  rows={4}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="primary" />
                      </InputAdornment>
                    )
                  }}
                  required
                />
              </Box>

              <Box flex={1} minWidth="300px">
                <TextField
                  fullWidth
                  label="職員のやること"
                  value={formData.staffSupportMethods}
                  onChange={(e) => handleChange('staffSupportMethods', e.target.value)}
                  placeholder="職員が提供する支援方法や注意点を具体的に記述してください"
                  multiline
                  rows={4}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <WorkIcon color="secondary" />
                      </InputAdornment>
                    )
                  }}
                  required
                />
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          キャンセル
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          {isEditing ? '更新' : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};