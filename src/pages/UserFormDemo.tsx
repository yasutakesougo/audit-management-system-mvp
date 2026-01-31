import { Box, Button, Container, Typography } from '@mui/material';
import React, { useState } from 'react';
import { UserForm } from '../features/users/UserForm';
import type { IUserMaster } from '../features/users/types';

const UserFormDemo: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | undefined>();

  // Sample user data to demonstrate the enhanced form
  const sampleUser: IUserMaster = {
    Id: 1,
    UserID: 'U-001',
    FullName: '山田太郎',
    Furigana: 'やまだ たろう',
    FullNameKana: 'ヤマダ タロウ',
    ContractDate: '2024-01-01',
    ServiceStartDate: '2024-01-15',
    ServiceEndDate: '',
    IsHighIntensitySupportTarget: false,
    IsActive: true,
    TransportToDays: ['月', '水', '金'],
    TransportFromDays: ['月', '水', '金'],
    AttendanceDays: ['月', '火', '水', '木', '金'],
    RecipientCertNumber: '1234567890',
    RecipientCertExpiry: '2025-03-31',

    // Enhanced fields
    UsageStatus: '利用中',
    GrantMunicipality: '横浜市磯子区',
    GrantPeriodStart: '2024-04-01',
    GrantPeriodEnd: '2025-03-31',
    DisabilitySupportLevel: '3',
    GrantedDaysPerMonth: '20',
    UserCopayLimit: '9300',
    TransportAdditionType: 'both',
    MealAddition: 'use',
    CopayPaymentMethod: 'bank',
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Enhanced UserForm Demo
      </Typography>

      <Typography variant="body1" paragraph>
        This demonstrates the enhanced UserForm with contract/grant decision/billing extensions.
        The form now includes:
      </Typography>

      <Box component="ul" sx={{ mb: 3 }}>
        <li><strong>Contract Information:</strong> Usage status tracking</li>
        <li><strong>Grant Decision Info:</strong> Municipality, support level, grant periods</li>
        <li><strong>Billing Information:</strong> Transport additions, meal additions, payment methods</li>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={() => {
            setSelectedUser(undefined);
            setShowForm(true);
          }}
        >
          Create New User
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setSelectedUser(sampleUser);
            setShowForm(true);
          }}
        >
          Edit Sample User
        </Button>
      </Box>

      {showForm && (
        <UserForm
          user={selectedUser}
          mode={selectedUser ? "update" : "create"}
          onSuccess={(user) => {
            if (import.meta.env.DEV) console.log('User saved:', user);
            alert(`User ${user.FullName} saved successfully!`);
          }}
          onDone={() => {
            setShowForm(false);
            setSelectedUser(undefined);
          }}
          onClose={() => {
            setShowForm(false);
            setSelectedUser(undefined);
          }}
        />
      )}
    </Container>
  );
};

export default UserFormDemo;