import React from 'react';
import { Box, Container, Stack, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { RoomStatusTab } from '@/features/dashboard/tabs/RoomStatusTab';

const RoomManagementPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {/* ヘッダー */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          variant="outlined"
          size="small"
        >
          戻る
        </Button>
        <Typography variant="h4" component="h1" fontWeight="bold">
          お部屋情報
        </Typography>
      </Stack>

      {/* コンテンツ */}
      <Box sx={{ bgcolor: '#fff', borderRadius: 1, p: { xs: 2, md: 3 } }}>
        <RoomStatusTab />
      </Box>
    </Container>
  );
};

export default RoomManagementPage;
