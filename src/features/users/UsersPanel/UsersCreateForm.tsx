import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PostAddIcon from '@mui/icons-material/PostAdd';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { FC, KeyboardEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { IUserMasterCreateDto } from '../types';

type UsersCreateFormProps = {
  existingUserIds: string[];
  isSubmitting: boolean;
  onCreate: (payload: IUserMasterCreateDto) => Promise<void> | void;
  onOpenDetailForm: () => void;
};

const UsersCreateForm: FC<UsersCreateFormProps> = ({ existingUserIds, isSubmitting, onCreate, onOpenDetailForm }) => {
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');

  const trimmedUserId = userId.trim();
  const trimmedFullName = fullName.trim();
  const canCreate = useMemo(() => Boolean(trimmedUserId && trimmedFullName && !isSubmitting), [isSubmitting, trimmedFullName, trimmedUserId]);

  const generateSimpleUserID = useCallback(() => {
    let nextNumber = 1;
    let newId = '';
    do {
      newId = `U-${nextNumber.toString().padStart(3, '0')}`;
      nextNumber += 1;
    } while (existingUserIds.includes(newId));
    setUserId(newId);
  }, [existingUserIds]);

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    const payload: IUserMasterCreateDto = {
      UserID: trimmedUserId,
      FullName: trimmedFullName,
      IsHighIntensitySupportTarget: false,
    };
    await onCreate(payload);
    setUserId('');
    setFullName('');
  }, [canCreate, onCreate, trimmedFullName, trimmedUserId]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        void handleCreate();
      }
    },
    [handleCreate]
  );

  return (
    <Stack spacing={2.5}>
      <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
        新規利用者登録
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="end">
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            label="ユーザーID"
            placeholder="U-001"
            size="small"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            onKeyDown={handleKeyDown}
            required
            sx={{ minWidth: 150 }}
          />
          <Button
            variant="outlined"
            onClick={generateSimpleUserID}
            size="small"
            sx={{ minWidth: 'auto', px: 1.5 }}
          >
            自動
          </Button>
        </Box>
        <TextField
          label="氏名"
          placeholder="山田太郎"
          size="small"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          onKeyDown={handleKeyDown}
          required
          sx={{ minWidth: 200 }}
        />
        <Button
          variant="contained"
          startIcon={<PersonAddRoundedIcon />}
          onClick={handleCreate}
          disabled={!canCreate}
          sx={{ minWidth: 120 }}
        >
          {isSubmitting ? '作成中…' : '簡易作成'}
        </Button>
      </Stack>
      <Divider sx={{ my: 1 }} />
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          詳細情報を含む新規登録はこちら：
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PostAddIcon />}
          onClick={onOpenDetailForm}
          sx={{ minWidth: 160 }}
        >
          詳細登録フォーム
        </Button>
      </Box>
    </Stack>
  );
};

export default UsersCreateForm;
