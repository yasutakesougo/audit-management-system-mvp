/**
 * AdminHubPage — 管理機能のハブページ
 *
 * 管理者向けツールへの導線を集約。
 * 今後の管理機能追加はここにカードを追加するだけで対応可能。
 */
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BadgeIcon from '@mui/icons-material/Badge';
import BuildIcon from '@mui/icons-material/Build';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CategoryIcon from '@mui/icons-material/Category';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import SyncIcon from '@mui/icons-material/Sync';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Container,
    Typography,
} from '@mui/material';
import React from 'react';
import { Link } from 'react-router-dom';

type AdminTool = {
  label: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  category: 'overview' | 'data' | 'system';
};

const ADMIN_TOOLS: AdminTool[] = [
  // Overview
  {
    label: '管理ダッシュボード',
    description: 'システム全体の状態を俯瞰',
    to: '/admin/dashboard',
    icon: <DashboardIcon />,
    category: 'overview',
  },
  {
    label: '自己点検',
    description: 'コンプライアンスチェックリスト',
    to: '/checklist',
    icon: <FactCheckIcon />,
    category: 'overview',
  },
  {
    label: '監査ログ',
    description: '操作履歴の確認',
    to: '/audit',
    icon: <VerifiedUserIcon />,
    category: 'overview',
  },
  // Data
  {
    label: 'データ整合性チェック',
    description: 'SharePoint データの検証と修復',
    to: '/admin/data-integrity',
    icon: <StorageIcon />,
    category: 'data',
  },
  {
    label: 'CSVインポート',
    description: '外部データの取り込み',
    to: '/admin/csv-import',
    icon: <UploadFileIcon />,
    category: 'data',
  },
  // System
  {
    label: 'ナビ診断',
    description: 'ナビゲーション構造の診断',
    to: '/admin/navigation-diagnostics',
    icon: <BuildIcon />,
    category: 'system',
  },
  {
    label: 'モード切替',
    description: 'デモ/本番モードの切替',
    to: '/admin/mode-switch',
    icon: <SyncIcon />,
    category: 'system',
  },
  {
    label: '支援手順マスタ',
    description: '支援手順テンプレートの管理',
    to: '/admin/step-templates',
    icon: <SettingsIcon />,
    category: 'system',
  },
  {
    label: '個別支援手順',
    description: '利用者別の支援手順管理',
    to: '/admin/individual-support',
    icon: <AdminPanelSettingsIcon />,
    category: 'system',
  },
  {
    label: '支援活動マスタ',
    description: '支援活動テンプレートの管理',
    to: '/admin/templates',
    icon: <CategoryIcon />,
    category: 'system',
  },
  {
    label: '職員勤怠管理',
    description: '職員の出勤・勤務管理',
    to: '/admin/staff-attendance',
    icon: <BadgeIcon />,
    category: 'system',
  },
  {
    label: '統合リソースカレンダー',
    description: 'リソースの統合スケジュール管理',
    to: '/admin/integrated-resource-calendar',
    icon: <CalendarMonthIcon />,
    category: 'system',
  },
];

const CATEGORY_LABELS: Record<AdminTool['category'], { title: string; emoji: string }> = {
  overview: { title: '概要・監査', emoji: '📊' },
  data: { title: 'データ管理', emoji: '🗄️' },
  system: { title: 'システム設定', emoji: '⚙️' },
};

const AdminHubPage: React.FC = () => {
  const categories = ['overview', 'data', 'system'] as const;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          ⚙️ 管理ツール
        </Typography>
        <Typography variant="body1" color="text.secondary">
          システム管理・データ管理・設定変更はここから行います。
        </Typography>
      </Box>

      {categories.map((category) => {
        const tools = ADMIN_TOOLS.filter((t) => t.category === category);
        const { title, emoji } = CATEGORY_LABELS[category];

        return (
          <Box key={category} sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              {emoji} {title}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                },
                gap: 2,
              }}
            >
              {tools.map((tool) => (
                <Card
                  key={tool.to}
                  variant="outlined"
                  sx={{
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 3,
                    },
                  }}
                >
                  <CardActionArea
                    component={Link}
                    to={tool.to}
                    sx={{ p: 0 }}
                    data-testid={`admin-hub-${tool.to.replace(/\//g, '-').slice(1)}`}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box
                        sx={{
                          color: 'primary.main',
                          mt: 0.5,
                          '& .MuiSvgIcon-root': { fontSize: 28 },
                        }}
                      >
                        {tool.icon}
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {tool.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {tool.description}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Box>
        );
      })}
    </Container>
  );
};

export default AdminHubPage;
