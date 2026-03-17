/**
 * ISP比較・更新エディタ — Page薄ラッパー
 * B層(hook) → A層(view) を接続するだけ
 * URL params: :userId (optional)
 *
 * userId 未指定時は UserSelectionGrid を表示し、
 * 選択後に /isp-editor/:userId へ遷移する。
 */
import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import ISPComparisonEditorView from '@/features/ibd/plans/isp-editor/components/ISPComparisonEditorView';
import { useISPComparisonEditor } from '@/features/ibd/plans/isp-editor/hooks/useISPComparisonEditor';
import { UserSelectionGrid } from '@/features/users/components/UserSelectionGrid';
import { useUsers } from '@/features/users/useUsers';
import DescriptionIcon from '@mui/icons-material/Description';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import React, { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function ISPComparisonEditorPage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { data: allUsers } = useUsers();

  // ---------- ユーザー未選択 → グリッド表示 ----------
  if (!userId) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <IBDPageHeader
          title="個別支援計画書エディタ"
          subtitle="利用者を選択して、個別支援計画書の比較・更新を行います。"
          icon={<DescriptionIcon />}
        />
        <Paper elevation={1}>
          <UserSelectionGrid
            users={allUsers}
            onSelect={(code) => navigate(`/isp-editor/${code}`)}
            title="対象利用者を選択してください"
            subtitle="個別支援計画書の比較・更新を行う利用者を選択します。行動分析対象者は優先表示されています。"
          />
        </Paper>
      </Box>
    );
  }

  // ---------- ユーザー選択済み → エディタ表示 ----------
  return <ISPEditorWorkspace userId={userId} allUsers={allUsers} />;
}

// ---------------------------------------------------------------------------
// ISPEditorWorkspace — userId 確定後のエディタ本体
// ---------------------------------------------------------------------------

interface ISPEditorWorkspaceProps {
  userId: string;
  allUsers: Array<{ Id: number; UserID: string; FullName: string; IsHighIntensitySupportTarget?: boolean | null }>;
}

const ISPEditorWorkspace: React.FC<ISPEditorWorkspaceProps> = ({ userId, allUsers }) => {
  const navigate = useNavigate();
  const vm = useISPComparisonEditor({ userId });

  const handleUserSwitch = useCallback(
    (event: SelectChangeEvent) => {
      navigate(`/isp-editor/${event.target.value}`);
    },
    [navigate],
  );

  const userOptions = useMemo(
    () => allUsers.map((u) => ({ id: u.UserID, label: u.FullName })),
    [allUsers],
  );

  return (
    <ISPComparisonEditorView
      {...vm}
      userSwitcher={
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="isp-user-select-label">利用者</InputLabel>
          <Select
            labelId="isp-user-select-label"
            value={userId}
            label="利用者"
            onChange={handleUserSwitch}
          >
            {userOptions.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      }
    />
  );
};
