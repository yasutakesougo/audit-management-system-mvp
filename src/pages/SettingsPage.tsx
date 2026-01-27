import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

/**
 * Settings Page - 設定・カスタマイズの統一窓口
 *
 * Phase 1: スケルトン（今後の項目だけ）
 * Phase 2: 表示 / 通知 / 診断の3セクション追加
 * Phase 3: テンプレート管理を /admin/settings/templates に移動
 */
export default function SettingsPage(): React.ReactElement {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
            設定
          </Typography>
          <Typography variant="body2" color="text.secondary">
            システムの表示・通知・診断設定を管理します
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              準備中...
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2 }}>
              今後追加される項目：
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <li>
                <Typography variant="body2">表示設定（ダークモード・文字サイズ等）</Typography>
              </li>
              <li>
                <Typography variant="body2">通知設定</Typography>
              </li>
              <li>
                <Typography variant="body2">診断・ヘルスチェック</Typography>
              </li>
              <li>
                <Typography variant="body2">テンプレート管理（管理者のみ）</Typography>
              </li>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
