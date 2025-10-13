import {
    EventNote as ActivityIcon,
    Assignment as AssignmentIcon,
    People as PeopleIcon,
    AssignmentTurnedIn as SupportIcon
} from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    Container,
    Paper,
    Stack,
    Typography
} from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsersDemo } from '../features/users/usersStoreDemo';

const DailyRecordMenuPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: users } = useUsersDemo();

  // 統計計算
  const totalUsers = users.length;
  const intensiveSupportUsers = users.filter(user => user.IsSupportProcedureTarget).length;

  // モック記録状況（実際のデータと連携予定）
  const mockActivityProgress = Math.floor(totalUsers * 0.75); // 75%完了
  const mockSupportProgress = Math.floor(intensiveSupportUsers * 0.6); // 60%完了

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* ヘッダー */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h3" component="h1" gutterBottom>
            日次記録システム
          </Typography>
          <Typography variant="h6" color="text.secondary">
            記録の種類を選択してください
          </Typography>
        </Box>

        {/* メニューカード */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={4}
          sx={{ mb: 4 }}
        >
          {/* 活動日誌 */}
          <Card
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, elevation 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                elevation: 8
              }
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ActivityIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
                <Typography variant="h5" component="h2">
                  活動日誌
                </Typography>
              </Box>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                利用者全員の日々の活動状況を記録します
              </Typography>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PeopleIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      対象：利用者全員（{totalUsers}名）
                    </Typography>
                  </Box>
                <Typography variant="body2" color="text.secondary">
                  • AM/PM活動内容
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 昼食摂取量
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 問題行動記録（自傷・暴力・大声・異食・その他）
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 発作記録（時刻・持続時間・重度・詳細）
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 特記事項
                </Typography>
              </Stack>
            </CardContent>

            <CardActions sx={{ p: 3, pt: 0 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => navigate('/daily/activity')}
                startIcon={<ActivityIcon />}
              >
                活動日誌を開く
              </Button>
            </CardActions>
          </Card>

          {/* 支援手順記録 */}
          <Card
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, elevation 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                elevation: 8
              }
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SupportIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />
                <Typography variant="h5" component="h2">
                  支援手順記録
                </Typography>
              </Box>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                個別支援計画に基づく支援手順の実施状況を記録します
              </Typography>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      対象：強度行動障害者（{intensiveSupportUsers}名）
                    </Typography>
                    <Chip
                      label="⚑ 特別支援"
                      size="small"
                      color="warning"
                      sx={{ fontSize: '0.6rem' }}
                    />
                  </Box>
                <Typography variant="body2" color="text.secondary">
                  • 個別支援計画テンプレート
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 1日19行の支援手順展開
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 本人の様子・反応記録
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 支援効果の観察・評価
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 手順変更・改善点の記録
                </Typography>
              </Stack>
            </CardContent>

            <CardActions sx={{ p: 3, pt: 0 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                color="secondary"
                onClick={() => navigate('/daily/support')}
                startIcon={<SupportIcon />}
              >
                支援手順記録を開く
              </Button>
            </CardActions>
          </Card>
        </Stack>

        {/* 統計情報（簡易版） */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            本日の記録状況
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            divider={<Box sx={{ borderLeft: '1px solid', borderColor: 'divider', height: '60px', display: { xs: 'none', sm: 'block' } }} />}
          >
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="primary.main">
                {mockActivityProgress} / {totalUsers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                活動日誌 記録済み
              </Typography>
              <Typography variant="caption" color="success.main">
                {Math.round((mockActivityProgress / totalUsers) * 100)}% 完了
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="secondary.main">
                {mockSupportProgress} / {intensiveSupportUsers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                支援手順記録 記録済み
              </Typography>
              <Typography variant="caption" color="warning.main">
                {intensiveSupportUsers > 0 ? Math.round((mockSupportProgress / intensiveSupportUsers) * 100) : 0}% 完了
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};

export default DailyRecordMenuPage;