import * as React from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const AdminTemplatesDeprecatedPage: React.FC = () => {
  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2} sx={{ maxWidth: 840, mx: 'auto' }}>
        <Typography variant="h5" component="h1">
          管理ページの移動について
        </Typography>

        <Alert severity="info">
          このページ（支援活動テンプレート管理）は、アプリ設定ページへ統合されました。
        </Alert>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body1">
                これまで <code>/admin/templates</code> にあった機能は、今後「設定」から管理する方針です。
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  component={RouterLink}
                  to="/settings"
                  variant="contained"
                >
                  設定（/settings）へ移動
                </Button>

                <Button
                  component={RouterLink}
                  to="/admin/settings/templates"
                  variant="outlined"
                  disabled
                >
                  管理者設定（準備中）
                </Button>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                ※「管理者設定（準備中）」は、次フェーズで <code>/admin/settings/*</code> として追加します。
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default AdminTemplatesDeprecatedPage;
