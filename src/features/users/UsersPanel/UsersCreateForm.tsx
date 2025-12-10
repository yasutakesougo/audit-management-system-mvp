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
  isSubmitting: boolean;
  onCreate: (payload: IUserMasterCreateDto) => Promise<void> | void;
  onOpenDetailForm: () => void;
};

const UsersCreateForm: FC<UsersCreateFormProps> = ({ isSubmitting, onCreate, onOpenDetailForm }) => {
  const [fullName, setFullName] = useState('');

  const trimmedFullName = fullName.trim();
  const canCreate = useMemo(() => Boolean(trimmedFullName) && !isSubmitting, [isSubmitting, trimmedFullName]);

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    const payload: IUserMasterCreateDto = {
      FullName: trimmedFullName,
      IsHighIntensitySupportTarget: false,
    };
    await onCreate(payload);
    setFullName('');
  }, [canCreate, onCreate, trimmedFullName]);

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
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          <TextField
            label="氏名"
            placeholder="山田太郎"
            size="small"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            onKeyDown={handleKeyDown}
            required
            fullWidth
          />
          <Typography variant="caption" color="text.secondary">
            利用者コード（U-xxx）は保存後に自動採番されます
          </Typography>
        </Stack>
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
