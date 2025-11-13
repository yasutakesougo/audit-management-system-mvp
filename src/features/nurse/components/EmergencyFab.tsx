import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FamilyRestroomRoundedIcon from '@mui/icons-material/FamilyRestroomRounded';
import LocalPhoneRoundedIcon from '@mui/icons-material/LocalPhoneRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Fab from '@mui/material/Fab';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import React, { useState } from 'react';

const EmergencyFab: React.FC = () => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [confirm, setConfirm] = useState<null | 'rescue' | 'family'>(null);

  return (
    <Box sx={{ position: 'fixed', right: 16, bottom: 88, zIndex: 1200 }}>
      <Fab color="error" onClick={(event) => setAnchor(event.currentTarget)} aria-label="緊急対応">
        <WarningAmberRoundedIcon />
      </Fab>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setConfirm('rescue');
          }}
        >
          <ListItemIcon>
            <LocalPhoneRoundedIcon color="error" />
          </ListItemIcon>
          <ListItemText primary="救急要請（事業所に通知）" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setConfirm('family');
          }}
        >
          <ListItemIcon>
            <FamilyRestroomRoundedIcon color="primary" />
          </ListItemIcon>
          <ListItemText primary="家族へ連絡" />
        </MenuItem>
        <MenuItem onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <DescriptionRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="緊急記録フォーム" />
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}>
        <DialogTitle>確認</DialogTitle>
        <DialogContent>この操作を実行します。よろしいですか？</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>キャンセル</Button>
          <Button
            variant="contained"
            color={confirm === 'rescue' ? 'error' : 'primary'}
            onClick={() => setConfirm(null)}
          >
            実行
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmergencyFab;
