import React from 'react';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, IconButton, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUsers } from '@/features/users/useUsers';

export const KioskUserSelectScreen: React.FC = () => {
  const location = useLocation();
  const { data: users, isLoading } = useUsers({ selectMode: 'core' });

  // キオスクモードでは「支援手順対象」の利用者を表示。
  // IsActive が明示的に false の場合は除外する。
  const activeUsers = users.filter(u => u.IsSupportProcedureTarget && u.IsActive !== false);

  return (
    <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <IconButton 
          component={RouterLink}
          to={appendKioskSearchParams('/kiosk', location.search)} 
          sx={{ mr: 2, bgcolor: 'action.hover' }}
          data-testid="kiosk-user-select-back"
        >
          <ArrowBackIcon fontSize="large" />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          利用者を選択してください
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress size={60} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {activeUsers.map((user) => (
            <Grid key={user.Id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card 
                sx={{ 
                  height: '100%',
                  borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  '&:active': { transform: 'scale(0.98)' },
                  transition: 'transform 0.1s'
                }}
                data-testid={`kiosk-user-card-${user.Id}`}
              >
                <CardActionArea 
                  component={RouterLink}
                  to={appendKioskSearchParams(`/kiosk/users/${user.Id}/procedures`, location.search)}
                  sx={{ height: '100%', p: 3 }}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography 
                      variant="body1" 
                      color="text.secondary" 
                      sx={{ mb: 1, letterSpacing: '0.1em' }}
                    >
                      {user.Furigana || '　'}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {user.FullName}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
          {activeUsers.length === 0 && (
            <Grid size={12}>
              <Box sx={{ p: 8, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  対象の利用者がいません
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};
