import * as React from 'react';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';

import { useFeatureFlag } from '@/config/featureFlags';
import { type DashboardAudience } from '@/features/auth/store';
import { TESTIDS } from '@/testids';

import { ICEBERG_PDCA_EMPTY_COPY, type IcebergPdcaEmptyContext } from './icebergPdcaEmptyCopy';

type Props = {
  context: IcebergPdcaEmptyContext;
  role?: DashboardAudience;
  onSelectUser?: () => void;
  onCreate?: () => void;
};

export const IcebergPdcaEmptyState: React.FC<Props> = ({
  context,
  role,
  onSelectUser,
  onCreate,
}) => {
  const icebergPdca = useFeatureFlag('icebergPdca');
  const copy = ICEBERG_PDCA_EMPTY_COPY[context];

  const actions = (() => {
    if (context === 'no-user-selected') {
      return (
        <Button
          variant="contained"
          onClick={onSelectUser}
          data-testid={TESTIDS.ICEBERG_PDCA_EMPTY}
        >
          {copy.actions?.[0] ?? '利用者を選ぶ'}
        </Button>
      );
    }

    if (context === 'no-items-admin' && role === 'admin') {
      return (
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={onCreate}
            data-testid={TESTIDS.ICEBERG_PDCA_EMPTY}
          >
            {copy.actions?.[0] ?? 'PDCAを新規作成'}
          </Button>
          <Button
            variant="outlined"
            onClick={onSelectUser}
            disabled={!onSelectUser}
          >
            別の利用者を選ぶ
          </Button>
        </Stack>
      );
    }

    return null;
  })();

  return (
    <Card variant="outlined" sx={{ maxWidth: 640 }}>
      <CardContent>
        <Stack spacing={1}>
          <Box>
            <Typography variant="h6" component="h2">
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
            {!icebergPdca && (
              <Typography variant="caption" color="text.secondary">
                機能フラグ「icebergPdca」がオフのため、表示のみの状態です。
              </Typography>
            )}
          </Box>

          {actions && <Box sx={{ pt: 1 }}>{actions}</Box>}
        </Stack>
      </CardContent>
    </Card>
  );
};
