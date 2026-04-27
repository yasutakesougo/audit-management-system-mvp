import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { MuiRouterLink } from '@/lib/muiLink';
import type { IUserMaster } from '../types';
import { canEditUser, resolveUserLifecycleStatus } from '../domain/userLifecycle';
import { formatDateLabel, resolveUserIdentifier } from './helpers';

type UserDetailHeaderProps = {
  user: IUserMaster;
  variant?: 'page' | 'embedded';
  onEdit?: (user: IUserMaster) => void;
  attendanceLabel: string;
  supportLabel: string;
  isActive: boolean;
};

export const UserDetailHeader: React.FC<UserDetailHeaderProps> = ({
  user,
  variant = 'page',
  onEdit,
  attendanceLabel,
  supportLabel,
  isActive,
}) => {
  const isEmbedded = variant === 'embedded';
  const lifecycleStatus = resolveUserLifecycleStatus(user);

  return (
    <Paper variant="outlined" sx={{ p: isEmbedded ? 2 : { xs: 2.5, md: 3 }, borderRadius: isEmbedded ? 2 : 3 }}>
      <Stack spacing={isEmbedded ? 1 : 2}>
        <Stack direction="row" spacing={isEmbedded ? 1.5 : 2} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', color: '#fff', width: isEmbedded ? 40 : 56, height: isEmbedded ? 40 : 56 }}>
            <PeopleAltRoundedIcon fontSize={isEmbedded ? 'small' : 'medium'} />
          </Avatar>
          <Box>
            {!isEmbedded && (
              <Typography variant="overline" color="text.secondary">
                利用者プロフィール
              </Typography>
            )}
            <Typography variant={isEmbedded ? 'h6' : 'h4'} component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {user.FullName || '氏名未登録'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {resolveUserIdentifier(user)}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center" sx={{ rowGap: 0.5 }}>
          {isEmbedded && (
            <Chip
              label={
                lifecycleStatus === 'terminated' ? '終了'
                : lifecycleStatus === 'suspended' ? '休止'
                : lifecycleStatus === 'unknown' ? '状態未確定'
                : '利用中'
              }
              color={
                lifecycleStatus !== 'active' ? 'default' : 'success'
              }
              size="small"
            />
          )}
          {!isEmbedded && (
            <Chip label={`利用者コード: ${resolveUserIdentifier(user)}`} size="small" />
          )}
          <Chip label={supportLabel} color={user.IsHighIntensitySupportTarget ? 'warning' : 'default'} size="small" />
          {user.IsSupportProcedureTarget && (
            <Chip label="支援手順対象" color="secondary" size="small" />
          )}
          {!isEmbedded && (
            <Chip label={isActive ? '在籍' : '退所'} color={isActive ? 'success' : 'default'} size="small" />
          )}
          {!isEmbedded && (
            <>
              <Chip label={`契約日: ${formatDateLabel(user.ContractDate)}`} size="small" variant="outlined" />
              <Chip label={`利用開始日: ${formatDateLabel(user.ServiceStartDate)}`} size="small" variant="outlined" />
              {user.ServiceEndDate && (
                <Chip label={`利用終了日: ${formatDateLabel(user.ServiceEndDate)}`} size="small" variant="outlined" />
              )}
            </>
          )}
        </Stack>

        {!isEmbedded && (
          <>
            <Divider />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  通所予定日
                </Typography>
                <Typography variant="body1">{attendanceLabel}</Typography>
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  メモ
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  利用者関連の主要帳票へアクセスするためのメニューです。表示されている「利用者コード」はシステム用で、職員が覚える必要はありません。
                </Typography>
              </Box>
            </Stack>
          </>
        )}

        {isEmbedded && (
          <>
            <Divider />
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '100px 1fr', columnGap: 1.5, rowGap: 0.75, fontSize: '0.85rem' }}>
              <Typography component="dt" variant="caption" color="text.secondary">契約日</Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatDateLabel(user.ContractDate)}</Typography>
              <Typography component="dt" variant="caption" color="text.secondary">利用開始日</Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatDateLabel(user.ServiceStartDate)}</Typography>
              {user.ServiceEndDate && (
                <>
                  <Typography component="dt" variant="caption" color="text.secondary">利用終了日</Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatDateLabel(user.ServiceEndDate)}</Typography>
                </>
              )}
              <Typography component="dt" variant="caption" color="text.secondary">通所予定日</Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>{attendanceLabel}</Typography>
              {user.RecipientCertNumber && (
                <>
                  <Typography component="dt" variant="caption" color="text.secondary">受給者証</Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>****{user.RecipientCertNumber.slice(-4)}</Typography>
                </>
              )}
            </Box>
          </>
        )}

        {isEmbedded && (
          <>
            <Divider />
            <Stack direction="row" spacing={1}>
              {onEdit && canEditUser(user) && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditRoundedIcon />}
                  onClick={() => onEdit(user)}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  編集
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<OpenInNewRoundedIcon />}
                component={MuiRouterLink}
                to={`/users/${encodeURIComponent(user.UserID || String(user.Id))}`}
                sx={{ textTransform: 'none', flex: 1 }}
              >
                詳細を表示
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
};
