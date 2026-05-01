import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * KioskHomeScreen - キオスクモードの入口画面
 * 
 * タブレットでの操作を想定し、押しやすい大きなボタンを配置。
 * 「支援手順を実施する」を最優先の導線として強調。
 */
export const KioskHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search ?? '';
  // ボタンクリック時の挙動は今回はプレースホルダー（アラート等は出さない）
  const handlePlaceholder = () => {
    // 今後のPRで実装予定
  };

  return (
    <Box 
      sx={{ 
        p: { xs: 2, md: 4 }, 
        maxWidth: 800, 
        mx: 'auto', 
        mt: { xs: 2, md: 6 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <Typography 
        variant="h3" 
        component="h1" 
        gutterBottom 
        sx={{ 
          fontWeight: 900, 
          color: 'primary.main',
          mb: 1
        }}
      >
        キオスクモード
      </Typography>
      <Typography 
        variant="h6" 
        sx={{ 
          mb: 6, 
          color: 'text.secondary',
          fontWeight: 500
        }}
      >
        今日の操作を選んでください
      </Typography>

      <Grid container spacing={3}>
        {/* メインアクション: 支援手順を実施する */}
        <Grid size={12}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            color="primary"
            data-testid="kiosk-action-execute-steps"
            startIcon={<PlayCircleOutlineIcon sx={{ fontSize: '2.5rem !important' }} />}
            sx={{
              py: 6,
              fontSize: '1.75rem',
              fontWeight: 'bold',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              '&:active': {
                transform: 'scale(0.98)',
              },
              transition: 'transform 0.1s ease-in-out',
            }}
            onClick={() => navigate(`/kiosk/users${search}`)}
          >
            支援手順を実施する
          </Button>
        </Grid>

        {/* サブアクション: 通所・退所 */}
        <Grid size={6}>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            data-testid="kiosk-action-attendance"
            startIcon={<LoginIcon sx={{ fontSize: '1.5rem !important' }} />}
            sx={{
              py: 4,
              fontSize: '1.25rem',
              fontWeight: 'bold',
              borderRadius: 4,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
              },
            }}
            onClick={handlePlaceholder}
          >
            通所する
          </Button>
        </Grid>
        <Grid size={6}>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            data-testid="kiosk-action-leave"
            startIcon={<LogoutIcon sx={{ fontSize: '1.5rem !important' }} />}
            sx={{
              py: 4,
              fontSize: '1.25rem',
              fontWeight: 'bold',
              borderRadius: 4,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
              },
            }}
            onClick={handlePlaceholder}
          >
            退所する
          </Button>
        </Grid>

        {/* サブアクション: 今日の予定 */}
        <Grid size={12}>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            data-testid="kiosk-action-schedule"
            startIcon={<EventNoteIcon sx={{ fontSize: '1.5rem !important' }} />}
            sx={{
              py: 3,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: 3,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
              },
              mt: 2
            }}
            onClick={handlePlaceholder}
          >
            今日の予定を見る
          </Button>
        </Grid>
      </Grid>

      {/* 管理者向け情報は出さないが、開発用IDなどは data-属性に隠すことは許容 */}
    </Box>
  );
};
