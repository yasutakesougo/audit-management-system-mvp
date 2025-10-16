import {
    AccessTime as AccessTimeIcon,
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    MoreVert as MoreVertIcon,
    Person as PersonIcon,
    Restaurant as RestaurantIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    Menu,
    MenuItem,
    Stack,
    Typography
} from '@mui/material';
import React from 'react';
import { DailyStatus, PersonDaily } from '../../domain/daily/types';

interface DailyRecordListProps {
  records: PersonDaily[];
  onEdit: (record: PersonDaily) => void;
  onDelete: (recordId: number) => void;
  loading?: boolean;
}

const statusColors: Record<DailyStatus, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'> = {
  '未作成': 'default',
  '作成中': 'warning',
  '完了': 'success'
};

const statusIcons: Record<DailyStatus, React.ReactElement> = {
  '未作成': <WarningIcon fontSize="small" />,
  '作成中': <AccessTimeIcon fontSize="small" />,
  '完了': <CheckCircleIcon fontSize="small" />
};

export function DailyRecordList({ records, onEdit, onDelete, loading = false }: DailyRecordListProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedRecord, setSelectedRecord] = React.useState<PersonDaily | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, record: PersonDaily) => {
    setAnchorEl(event.currentTarget);
    setSelectedRecord(record);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRecord(null);
  };

  const handleEdit = () => {
    if (selectedRecord) {
      onEdit(selectedRecord);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedRecord) {
      onDelete(selectedRecord.id);
    }
    handleMenuClose();
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          読み込み中...
        </Typography>
      </Box>
    );
  }

  if (records.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          まだ日次記録がありません
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {records.map((record) => (
          <Card key={record.id} variant="outlined">
            <CardContent>
              {/* ヘッダー部分 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {record.personName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {record.personId}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={statusIcons[record.status]}
                    label={record.status}
                    color={statusColors[record.status]}
                    size="small"
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, record)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* 基本情報 */}
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>日付:</strong> {record.date}
                </Typography>
                <Typography variant="body2">
                  <strong>記録者:</strong> {record.reporter.name}
                </Typography>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* 活動情報 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeIcon fontSize="small" />
                  活動記録
                </Typography>

                {record.data.amActivities.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">午前:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {record.data.amActivities.map((activity, index) => (
                        <Chip
                          key={index}
                          label={activity}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {record.data.pmActivities.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">午後:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {record.data.pmActivities.map((activity, index) => (
                        <Chip
                          key={index}
                          label={activity}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* 食事情報 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <RestaurantIcon fontSize="small" />
                  食事記録
                </Typography>
                <Chip
                  label={`食事摂取量: ${record.data.mealAmount || '完食'}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>

              {/* 問題行動 */}
              {record.data.problemBehavior && (
                record.data.problemBehavior.selfHarm ||
                record.data.problemBehavior.violence ||
                record.data.problemBehavior.loudVoice ||
                record.data.problemBehavior.pica ||
                record.data.problemBehavior.other
              ) && (
                <Box sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {record.data.problemBehavior.selfHarm && (
                      <Chip label="自傷" size="small" color="warning" />
                    )}
                    {record.data.problemBehavior.violence && (
                      <Chip label="暴力" size="small" color="warning" />
                    )}
                    {record.data.problemBehavior.loudVoice && (
                      <Chip label="大声" size="small" color="warning" />
                    )}
                    {record.data.problemBehavior.pica && (
                      <Chip label="異食" size="small" color="warning" />
                    )}
                    {record.data.problemBehavior.other && (
                      <Chip label="その他" size="small" color="warning" />
                    )}
                  </Stack>
                </Box>
              )}

              {/* 発作記録 */}
              {record.data.seizureRecord?.occurred && (
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={`発作あり${record.data.seizureRecord.severity ? ` (${record.data.seizureRecord.severity})` : ''}`}
                    size="small"
                    color="error"
                    icon={<WarningIcon />}
                  />
                </Box>
              )}

              {/* 特記事項 */}
              {record.data.specialNotes && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    特記事項
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {record.data.specialNotes}
                  </Typography>
                </Box>
              )}

              {/* メモ */}
              {(record.data.amNotes || record.data.pmNotes) && (
                <Box sx={{ mt: 2 }}>
                  {record.data.amNotes && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      午前メモ: {record.data.amNotes}
                    </Typography>
                  )}
                  {record.data.pmNotes && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      午後メモ: {record.data.pmNotes}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* コンテキストメニュー */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          編集
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          削除
        </MenuItem>
      </Menu>
    </>
  );
}