import { RoomStatusTab } from '@/features/dashboard/tabs/RoomStatusTab';
import { AppBar, Box, Container, Paper, Toolbar, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

/**
 * Room Management Page - Independent page for room reservation management
 * Provides access to room availability, reservations, and scheduling features
 */
export const RoomManagementPage: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page Header */}
      <AppBar
        position="static"
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🏢 お部屋情報
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Container maxWidth="lg">
          <Paper elevation={3} sx={{ p: 2, minHeight: 'calc(100vh - 120px)' }}>
            <RoomStatusTab />
          </Paper>
        </Container>
      </Box>
    </Box>
  );
};

export default RoomManagementPage;
