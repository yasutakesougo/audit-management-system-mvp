import { Box, Container, Paper, Typography } from '@mui/material';
import React from 'react';
import UsageStatusDashboard from '../features/users/UsageStatusDashboard.v2';
import type { IUserMaster } from '../features/users/types';

const UsageDashboardDemo: React.FC = () => {
  // サンプルデータ
  const sampleUsers: IUserMaster[] = [
    {
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
    },
    {
      Id: 2,
      UserID: 'U-002',
      FullName: '佐藤花子',
      Furigana: 'さとう はなこ',
      FullNameKana: 'サトウ ハナコ',
      ContractDate: '2024-02-01',
      ServiceStartDate: '2024-02-15',
      ServiceEndDate: '',
      IsHighIntensitySupportTarget: true,
      IsActive: true,
      TransportToDays: ['火', '木'],
      TransportFromDays: ['火', '木'],
      AttendanceDays: ['火', '木'],
      RecipientCertNumber: '2345678901',
      RecipientCertExpiry: '2024-12-31', // 期限が近い例

      UsageStatus: '利用中',
      GrantMunicipality: '川崎市川崎区',
      GrantPeriodStart: '2024-04-01',
      GrantPeriodEnd: '2025-03-31',
      DisabilitySupportLevel: '5',
      GrantedDaysPerMonth: '15',
      UserCopayLimit: '4600',
      TransportAdditionType: 'oneway-to',
      MealAddition: 'not-use',
      CopayPaymentMethod: 'cash-office',
    },
    {
      Id: 3,
      UserID: 'U-003',
      FullName: '田中一郎',
      Furigana: 'たなか いちろう',
      FullNameKana: 'タナカ イチロウ',
      ContractDate: '2024-03-01',
      ServiceStartDate: '2024-03-15',
      ServiceEndDate: '',
      IsHighIntensitySupportTarget: false,
      IsActive: true,
      TransportToDays: ['月', '火', '水', '木', '金'],
      TransportFromDays: ['月', '火', '水', '木', '金'],
      AttendanceDays: ['月', '火', '水', '木', '金'],
      RecipientCertNumber: '3456789012',
      RecipientCertExpiry: '2025-06-30',

      UsageStatus: '利用中',
      GrantMunicipality: '横浜市港北区',
      GrantPeriodStart: '2024-04-01',
      GrantPeriodEnd: '2025-03-31',
      DisabilitySupportLevel: '2',
      GrantedDaysPerMonth: '22',
      UserCopayLimit: '18500',
      TransportAdditionType: 'both',
      MealAddition: 'use',
      CopayPaymentMethod: 'bank',
    },
  ];

  // サンプル利用状況データ（支援記録から集計される想定）
  const usageMap = {
    'U-001': { grantedDays: 20, usedDays: 18 }, // 残り少ない例
    'U-002': { grantedDays: 15, usedDays: 8 },  // まだ余裕
    'U-003': { grantedDays: 22, usedDays: 21 }, // 残りわずか例
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          利用状況ダッシュボード デモ
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          統合された UserForm の拡張フィールドと連動したダッシュボード機能のデモです。
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <UsageStatusDashboard
          users={sampleUsers}
          usageMap={usageMap}
        />
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          デモの特徴
        </Typography>
        <Box component="ul" sx={{ pl: 2 }}>
          <li><strong>山田太郎さん:</strong> 残り利用日数が少ない（18/20日使用）</li>
          <li><strong>佐藤花子さん:</strong> 受給者証期限が近い（2024年12月末）</li>
          <li><strong>田中一郎さん:</strong> 今月ほぼ使い切り（21/22日使用）</li>
        </Box>
      </Box>
    </Container>
  );
};

export default UsageDashboardDemo;