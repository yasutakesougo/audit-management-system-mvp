import React from 'react';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, IconButton, CircularProgress, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';

export const KioskUserSelectScreen: React.FC = () => {
  const location = useLocation();
  const { data: users, status } = useUsersQuery({ selectMode: 'core' });
  const isLoading = status === 'loading';

  // キオスクモードでは「支援手順対象」または「強度行動障害支援対象」の利用者を表示。
  // IsActive が明示的に false の場合は除外する。
  const activeUsers = users.filter(u => 
    (u.IsSupportProcedureTarget || u.IsHighIntensitySupportTarget) && 
    u.IsActive !== false
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: { xs: 2, md: 4 }, display: 'flex', alignItems: 'center' }}>
        <IconButton 
          component={RouterLink}
          to={appendKioskSearchParams('/kiosk', location.search)} 
          sx={{ mr: 2, bgcolor: 'action.hover' }}
          data-testid="kiosk-user-select-back"
        >
          <ArrowBackIcon fontSize="medium" />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
          利用者を選択してください
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress size={48} />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {activeUsers.map((user) => (
            <Grid key={user.Id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card 
                sx={{ 
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  '&:active': { transform: 'scale(0.98)' },
                  transition: 'transform 0.1s'
                }}
                data-testid={`kiosk-user-card-${user.Id}`}
              >
                <CardActionArea 
                  component={RouterLink}
                  to={appendKioskSearchParams(`/kiosk/users/${user.Id}/procedures`, location.search)}
                  sx={{ height: '100%', p: { xs: 2, md: 3 } }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 0 }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ mb: 0.5, letterSpacing: '0.05em' }}
                    >
                      {user.Furigana || '　'}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {user.FullName}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      {user.IsHighIntensitySupportTarget && (
                        <Chip 
                          label="強度行動障害支援対象" 
                          size="small" 
                          color="error" 
                          variant="outlined"
                          sx={{ fontWeight: 'bold', borderRadius: 1, fontSize: '0.75rem' }}
                        />
                      )}
                      {user.IsSupportProcedureTarget && !user.IsHighIntensitySupportTarget && (
                        <Chip 
                          label="支援手順対象" 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                          sx={{ fontWeight: 'bold', borderRadius: 1, fontSize: '0.75rem' }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
          {activeUsers.length === 0 && (
            <Grid size={12}>
              <Box sx={{ p: 6, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 4 }}>
                <Typography variant="subtitle1" color="text.secondary">
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
