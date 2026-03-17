/**
 * CsvImportPage — 型定義・定数
 */
import React from 'react';
import GroupIcon from '@mui/icons-material/Group';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DescriptionIcon from '@mui/icons-material/Description';

import type { ImportTarget } from '@/features/import/hooks/useUnifiedCSVImport';

// ─────────────────────────────────────────────
// TargetConfig
// ─────────────────────────────────────────────

export type TargetConfig = {
  id: ImportTarget;
  label: string;
  description: string;
  icon: React.ReactNode;
  acceptHint: string;
  requiredFields: string;
  color: string;
  gradient: string;
};

export const TARGETS: TargetConfig[] = [
  {
    id: 'users',
    label: '利用者マスタ',
    description: 'Users_Master CSVをインポートして利用者情報を一括登録',
    icon: <GroupIcon />,
    acceptHint: 'UserID, FullName, AttendanceDays, etc.',
    requiredFields: 'UserID（利用者ID）、FullName（氏名）',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  {
    id: 'support',
    label: '日課表',
    description: 'SupportTemplate CSVをインポートして日課表を一括登録',
    icon: <ScheduleIcon />,
    acceptHint: 'UserCode, 時間帯, 活動内容, etc.',
    requiredFields: 'UserCode、時間帯、活動内容',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
  },
  {
    id: 'care',
    label: '要配慮事項',
    description: 'CarePoints CSVをインポートして配慮事項を一括登録',
    icon: <DescriptionIcon />,
    acceptHint: 'Usercode, PointText, IsActive, etc.',
    requiredFields: 'Usercode、PointText',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  },
];
