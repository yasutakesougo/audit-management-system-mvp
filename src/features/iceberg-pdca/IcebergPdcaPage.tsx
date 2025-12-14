import * as React from 'react';
import { Autocomplete, Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';

import { useFeatureFlag } from '@/config/featureFlags';
import { useAuthStore } from '@/features/auth/store';
import { useUsersStore } from '@/features/users/store';
import { TESTIDS } from '@/testids';

import { IcebergPdcaEmptyState } from './components/IcebergPdcaEmptyState';
import type { IcebergPdcaEmptyContext } from './components/icebergPdcaEmptyCopy';
import { useIcebergPdcaList } from './queries/useIcebergPdcaList';

export const IcebergPdcaPage: React.FC = () => {
  const role = useAuthStore((s) => s.currentUserRole);
  const icebergPdca = useFeatureFlag('icebergPdca');
  const { data: users = [], status: usersStatus } = useUsersStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const userFilterRef = React.useRef<HTMLInputElement | null>(null);

  const userOptions = React.useMemo(
    () =>
      users
        .filter((u) => (u.IsActive ?? true) && (u.FullName ?? '').trim().length > 0)
        .map((u) => ({
          id: u.UserID ?? String(u.Id),
          label: u.FullName ?? '',
        })),
    [users],
  );

  const selectedUserId = searchParams.get('userId') ?? undefined;
  const selectedOption = React.useMemo(
    () => userOptions.find((opt) => opt.id === selectedUserId) ?? null,
    [selectedUserId, userOptions],
  );

  const handleUserChange = (_: unknown, option: { id: string; label: string } | null) => {
    const next = new URLSearchParams(searchParams);
    if (option?.id) {
      next.set('userId', option.id);
    } else {
      next.delete('userId');
    }
    setSearchParams(next, { replace: true });
  };

  const focusUserFilter = () => {
    userFilterRef.current?.focus();
  };

  const { data: items = [], status } = useIcebergPdcaList(
    selectedUserId ? { userId: selectedUserId } : undefined,
  );

  if (!icebergPdca) {
    return (
      <Box data-testid={TESTIDS['iceberg-pdca-root']} sx={{ py: 2 }}>
        <IcebergPdcaEmptyState context="flag-off" role={role} />
      </Box>
    );
  }

  const context: IcebergPdcaEmptyContext | null = !selectedUserId
    ? 'no-user-selected'
    : status === 'success' && items.length === 0
      ? role === 'admin'
        ? 'no-items-admin'
        : 'no-items-staff'
      : null;

  return (
    <Box data-testid={TESTIDS['iceberg-pdca-root']} sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        氷山PDCA
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        行動の背景・気づき・改善を「見える化」する支援設計ツール
      </Typography>

      <Stack spacing={2} sx={{ mb: 2 }}>
        <Autocomplete
          options={userOptions}
          value={selectedOption}
          loading={usersStatus === 'idle' || usersStatus === 'loading'}
          onChange={handleUserChange}
          getOptionLabel={(opt) => opt.label}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="利用者で絞り込み"
              placeholder="田中 太郎"
              size="small"
              inputRef={(node) => {
                const ref = params.InputProps.ref;
                if (typeof ref === 'function') {
                  ref(node);
                } else if (ref) {
                  (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
                }
                userFilterRef.current = node;
              }}
            />
          )}
        />
      </Stack>

      {context ? (
        <IcebergPdcaEmptyState
          context={context}
          role={role}
          onSelectUser={() => {
            focusUserFilter();
          }}
        />
      ) : status === 'loading' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">読み込み中…</Typography>
        </Box>
      ) : (
        <Box>
          {/* TODO: replace with PDCA list view */}
          <Typography variant="body2">PDCA items: {items.length}</Typography>
        </Box>
      )}
    </Box>
  );
};

export default IcebergPdcaPage;
