/**
 * User Detail Dialog (Phase C-2)
 *
 * 目的：利用者の詳細情報をモーダルで表示
 *
 * 表示内容：
 * - 利用者の基本情報（名前、ステータス）
 * - 欠席・遅刻理由の詳細
 * - 緊急連絡先（家族、主治医）
 * - 本日のバイタル記録（体温、血圧）
 * - ケア・フラグ（水分制限、入浴予定など）
 * - 特記事項（アレルギー、服薬情報）
 *
 * データソース：
 * - attendanceSummary（出欠情報）
 * - briefingAlerts（Phase A のアラート情報）
 * - activityRecords（日報からのバイタル情報）
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InfoIcon from '@mui/icons-material/Info';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PhoneIcon from '@mui/icons-material/Phone';
import WarningIcon from '@mui/icons-material/Warning';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 利用者のステータス
 */
export type UserStatus = 'present' | 'absent' | 'late' | 'early';

/**
 * 利用者の詳細情報
 */
export interface UserDetail {
  id: string;
  name: string;
  status: UserStatus;
  /** 欠席・遅刻理由 */
  reason?: string;
  /** 緊急連絡先 */
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  /** バイタル情報 */
  vitals?: {
    temperature?: number;
    bloodPressure?: string;
    pulse?: number;
    note?: string;
  };
  /** ケア・フラグ */
  careFlags?: Array<{
    type: 'warning' | 'info';
    label: string;
    description: string;
  }>;
  /** 特記事項 */
  notes?: string;
}

export interface UserDetailDialogProps {
  /** モーダルの開閉状態 */
  open: boolean;
  /** 閉じる時のコールバック */
  onClose: () => void;
  /** 表示する利用者の詳細情報 */
  user: UserDetail | null;
}

/**
 * ステータスの設定
 */
const STATUS_CONFIG: Record<UserStatus, {
  color: string;
  label: string;
  icon: React.ReactElement;
}> = {
  present: {
    color: 'success.main',
    label: '登所中',
    icon: <PersonIcon />,
  },
  absent: {
    color: 'error.main',
    label: '欠席',
    icon: <PersonOffIcon />,
  },
  late: {
    color: 'warning.main',
    label: '遅刻',
    icon: <AccessTimeIcon />,
  },
  early: {
    color: 'warning.main',
    label: '早退',
    icon: <AccessTimeIcon />,
  },
};

/**
 * バイタル表示コンポーネント
 */
const VitalsDisplay: React.FC<{ vitals: UserDetail['vitals'] }> = ({ vitals }) => {
  if (!vitals) {
    return (
      <Typography variant="body2" color="text.secondary">
        本日のバイタル記録はまだありません
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {vitals.temperature && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 80 }}>
            体温:
          </Typography>
          <Chip
            label={`${vitals.temperature}°C`}
            size="small"
            color={vitals.temperature >= 37.5 ? 'error' : 'default'}
          />
        </Box>
      )}
      {vitals.bloodPressure && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 80 }}>
            血圧:
          </Typography>
          <Chip label={vitals.bloodPressure} size="small" />
        </Box>
      )}
      {vitals.pulse && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 80 }}>
            脈拍:
          </Typography>
          <Chip label={`${vitals.pulse} bpm`} size="small" />
        </Box>
      )}
      {vitals.note && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {vitals.note}
        </Alert>
      )}
    </Stack>
  );
};

/**
 * 利用者詳細ダイアログ
 * 利用者の状態、欠席理由、緊急連絡先、バイタル情報を統合表示
 */
export const UserDetailDialog: React.FC<UserDetailDialogProps> = ({
  open,
  onClose,
  user,
}) => {
  const navigate = useNavigate();
  if (!user) return null;

  const config = STATUS_CONFIG[user.status];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: config.color, width: 48, height: 48 }}>
            {user.name[0]}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{user.name}様</Typography>
            <Typography variant="caption" color="text.secondary">
              利用者ID: {user.id}
            </Typography>
          </Box>
          <Chip
            icon={config.icon}
            label={config.label}
            sx={{ bgcolor: config.color, color: 'white' }}
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* ケア・フラグ（重要事項） */}
          {user.careFlags && user.careFlags.length > 0 && (
            <>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  ⚠️ 重要事項
                </Typography>
                <Stack spacing={1}>
                  {user.careFlags.map((flag, index) => (
                    <Alert
                      key={index}
                      severity={flag.type}
                      icon={flag.type === 'warning' ? <WarningIcon /> : <InfoIcon />}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {flag.label}
                      </Typography>
                      <Typography variant="caption">{flag.description}</Typography>
                    </Alert>
                  ))}
                </Stack>
              </Box>
              <Divider />
            </>
          )}

          {/* 欠席・遅刻理由 */}
          {(user.status === 'absent' || user.status === 'late' || user.status === 'early') && (
            <>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  📝 {config.label}の理由
                </Typography>
                <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
                  <Typography variant="body2">
                    {user.reason || '理由が記入されていません'}
                  </Typography>
                </Box>
              </Box>
              <Divider />
            </>
          )}

          {/* バイタル情報（登所中のみ） */}
          {user.status === 'present' && (
            <>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  🩺 本日のバイタル
                </Typography>
                <VitalsDisplay vitals={user.vitals} />
              </Box>
              <Divider />
            </>
          )}

          {/* 緊急連絡先 */}
          {user.emergencyContacts && user.emergencyContacts.length > 0 && (
            <>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  📞 緊急連絡先
                </Typography>
                <List dense>
                  {user.emergencyContacts.map((contact, index) => (
                    <ListItem
                      key={index}
                      sx={{
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemIcon>
                        <PhoneIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {contact.name}
                            </Typography>
                            <Chip label={contact.relationship} size="small" />
                          </Stack>
                        }
                        secondary={contact.phone}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
              <Divider />
            </>
          )}

          {/* 特記事項 */}
          {user.notes && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                📌 特記事項
              </Typography>
              <Alert severity="info" icon={<LocalHospitalIcon />}>
                {user.notes}
              </Alert>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={<EditNoteIcon />}
          onClick={() => navigate(`/isp-editor/${user.id}`)}
          color="primary"
          sx={{ mr: 'auto', minHeight: 44 }}
        >
          ISPを確認
        </Button>
        <Button onClick={onClose} variant="contained">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};
