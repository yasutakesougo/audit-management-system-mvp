/**
 * OpsDetailDrawer — 詳細パネルコンテナ
 *
 * PC: 右側 Drawer (width: 400px)
 * Mobile: 下部 SwipeableDrawer
 */

import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { FC, ReactNode } from 'react';

import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';
import { OpsDetailAttentionSection } from './OpsDetailAttentionSection';
import { OpsDetailBasicInfo } from './OpsDetailBasicInfo';
import { OpsDetailHandoffSection } from './OpsDetailHandoffSection';
import { OpsDetailRelatedLinks } from './OpsDetailRelatedLinks';
import { OpsDetailSupportFlags } from './OpsDetailSupportFlags';

// ─── Shared Content ──────────────────────────────────────────────────────────

const DrawerContent: FC<{
  item: ScheduleOpsItem;
  canEdit: boolean;
  onEdit?: (item: ScheduleOpsItem) => void;
  onClose: () => void;
}> = ({ item, canEdit, onEdit, onClose }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight="bold">
          予定詳細
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEdit && (
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => onEdit?.(item)}
            >
              編集
            </Button>
          )}
          <IconButton onClick={onClose} size="small" aria-label="閉じる">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: 3, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <OpsDetailBasicInfo item={item} />
        
        <OpsDetailAttentionSection item={item} />
        
        <Divider />
        
        <OpsDetailSupportFlags item={item} canEdit={canEdit} />
        
        <OpsDetailHandoffSection item={item} />
        
        <OpsDetailRelatedLinks item={item} />

        {item.notes && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              メモ
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {item.notes}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Container ───────────────────────────────────────────────────────────────

export type OpsDetailDrawerProps = {
  item: ScheduleOpsItem | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (item: ScheduleOpsItem) => void;
  canEdit: boolean;
};

export const OpsDetailDrawer: FC<OpsDetailDrawerProps> = ({
  item,
  open,
  onClose,
  onEdit,
  canEdit,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!item) return null;

  const content: ReactNode = (
    <DrawerContent
      item={item}
      canEdit={canEdit}
      onEdit={onEdit}
      onClose={onClose}
    />
  );

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        PaperProps={{
          sx: { maxHeight: '90vh', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            bgcolor: 'divider',
            borderRadius: 2,
            mx: 'auto',
            mt: 1.5,
            mb: 0.5,
          }}
        />
        {content}
      </SwipeableDrawer>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 400 } }}
    >
      {content}
    </Drawer>
  );
};
