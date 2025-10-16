import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    FilterList as FilterIcon,
    Person as PersonIcon,
    Search as SearchIcon,
    AccessTime as TimeIcon,
    Work as WorkIcon,
} from '@mui/icons-material';
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    Fab,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { SupportStepTemplate, defaultSupportStepTemplates } from '../../domain/support/step-templates';

interface SupportStepTemplateListProps {
  templates?: SupportStepTemplate[];
  onEdit?: (template: SupportStepTemplate) => void;
  onDelete?: (templateId: string) => void;
  onAdd?: () => void;
}

export const SupportStepTemplateList: React.FC<SupportStepTemplateListProps> = ({
  templates,
  onEdit,
  onDelete,
  onAdd
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('');

  // デフォルトテンプレートをIDと一緒に使用
  const defaultTemplatesWithIds: SupportStepTemplate[] = useMemo(() =>
    defaultSupportStepTemplates.map((template, index) => ({
      ...template,
      id: `default-${index + 1}`
    })), []
  );

  const allTemplates = templates || defaultTemplatesWithIds;

  // フィルタリング処理
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(template => {
      const matchesSearch = searchQuery === '' ||
        template.stepTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.targetBehavior.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.supportMethod.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === '' || template.category === categoryFilter;
      const matchesImportance = importanceFilter === '' || template.importance === importanceFilter;

      return matchesSearch && matchesCategory && matchesImportance;
    });
  }, [allTemplates, searchQuery, categoryFilter, importanceFilter]);

  // カテゴリの重要度による色分け
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case '必須': return 'error';
      case '推奨': return 'warning';
      case '任意': return 'info';
      default: return 'default';
    }
  };

  // カテゴリの色分け
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
    return colorMap[category] || '#f5f5f5';
  };

  return (
    <Box>
      {/* 検索・フィルターエリア */}
      <Card sx={{ mb: 3 }} elevation={2}>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '2fr 1.5fr 1.5fr 1fr'
              },
              gap: 2,
              alignItems: 'center'
            }}
          >
            <TextField
              fullWidth
              label="検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              placeholder="手順名、説明、支援方法で検索..."
            />
            <FormControl fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={categoryFilter}
                label="カテゴリ"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
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
            <FormControl fullWidth>
              <InputLabel>重要度</InputLabel>
              <Select
                value={importanceFilter}
                label="重要度"
                onChange={(e) => setImportanceFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                <MenuItem value="必須">必須</MenuItem>
                <MenuItem value="推奨">推奨</MenuItem>
                <MenuItem value="任意">任意</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {filteredTemplates.length} 件のテンプレート
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* テンプレート一覧 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)'
          },
          gap: 3
        }}
      >
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            sx={{
              height: '100%',
              borderLeft: `4px solid ${getCategoryColor(template.category)}`,
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-2px)',
                transition: 'all 0.2s ease-in-out'
              }
            }}
            elevation={1}
          >
            <CardContent>
              {/* ヘッダー部分 */}
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box flex={1}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                      {template.iconEmoji || '📋'}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                        {template.stepTitle}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {template.timeSlot}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box display="flex" gap={1}>
                  <Tooltip title="編集">
                    <IconButton
                      size="small"
                      onClick={() => onEdit?.(template)}
                      sx={{ color: 'primary.main' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="削除">
                    <IconButton
                      size="small"
                      onClick={() => onDelete?.(template.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* チップ部分 */}
              <Stack direction="row" spacing={1} mb={2}>
                <Chip
                  label={template.category}
                  size="small"
                  sx={{
                    bgcolor: getCategoryColor(template.category),
                    color: 'text.primary'
                  }}
                />
                <Chip
                  label={template.importance}
                  size="small"
                  color={getImportanceColor(template.importance) as 'error' | 'warning' | 'info' | 'default'}
                />
                <Chip
                  icon={<TimeIcon />}
                  label={`${template.duration}分`}
                  size="small"
                  variant="outlined"
                />
                {template.isRequired && (
                  <Chip
                    label="必須"
                    size="small"
                    variant="outlined"
                    color="error"
                  />
                )}
              </Stack>

              {/* 説明 */}
              <Typography variant="body2" color="text.secondary" mb={2}>
                {template.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* 目標行動・支援方法 */}
              <Box>
                <Box mb={2}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <PersonIcon sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="primary.main">
                      目標とする行動
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    {template.targetBehavior}
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
                    {template.supportMethod}
                  </Typography>
                </Box>

                {template.precautions && (
                  <Box>
                    <Typography variant="subtitle2" color="warning.main" sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                      ⚠️ 注意・配慮事項
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      {template.precautions}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* 結果が0件の場合 */}
      {filteredTemplates.length === 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box textAlign="center" py={4}>
              <FilterIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" mb={1}>
                該当するテンプレートが見つかりません
              </Typography>
              <Typography variant="body2" color="text.disabled">
                検索条件を変更するか、新しいテンプレートを作成してください
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 新規作成ボタン */}
      <Fab
        color="primary"
        aria-label="新規テンプレート作成"
        onClick={onAdd}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000
        }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};