/**
 * Todo Detail Dialog (Phase C-2 Final)
 * 
 * 目的：自動抽出されたタスクの詳細情報を表示
 * 
 * 表示内容：
 * - タスクの基本情報（タイトル、優先度、期限、担当者）
 * - タスクタイプ別のアクションチェックリスト
 * - 関連利用者情報へのリンク
 * - ステータス管理（未着手/進行中/完了）※将来実装
 * 
 * デザインポイント：
 * - 新人職員でも手順を間違えずに遂行できる
 * - 利用者情報に素早くアクセスできる
 * - 緊急性が視覚的にわかる
 */

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MedicationIcon from '@mui/icons-material/Medication';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { TodoItem } from '@/features/dashboard/tabs/TodoTab';

export interface TodoDetailDialogProps {
  /** モーダルの開閉状態 */
  open: boolean;
  /** 閉じる時のコールバック */
  onClose: () => void;
  /** 表示するタスクの詳細情報 */
  todo: TodoItem | null;
  /** 利用者詳細を開くコールバック（オプション） */
  onOpenUserDetail?: (userId: string) => void;
}

/**
 * タスクタイプごとのアイコンと色設定
 */
const TASK_TYPE_CONFIG: Record<TodoItem['type'], {
  icon: React.ReactElement;
  color: string;
  label: string;
}> = {
  medication: {
    icon: <MedicationIcon />,
    color: '#d32f2f',
    label: '服薬介助',
  },
  hospital: {
    icon: <LocalHospitalIcon />,
    color: '#d32f2f',
    label: '通院同行',
  },
  cleaning: {
    icon: <CleaningServicesIcon />,
    color: '#f57c00',
    label: '清掃・点検',
  },
  other: {
    icon: <AssignmentIcon />,
    color: '#616161',
    label: '一般タスク',
  },
};

/**
 * 優先度の設定（色、ラベル）
 */
const PRIORITY_CONFIG: Record<TodoItem['priority'], {
  color: 'error' | 'warning' | 'default';
  label: string;
  description: string;
}> = {
  high: {
    color: 'error',
    label: '高優先度',
    description: '命に関わる重要事項。最優先で実施してください。',
  },
  medium: {
    color: 'warning',
    label: '中優先度',
    description: '本日中に実施が必要です。',
  },
  low: {
    color: 'default',
    label: '低優先度',
    description: '時間があれば対応してください。',
  },
};

/**
 * タスクタイプ別のアクションチェックリスト
 */
const ACTION_CHECKLIST: Record<TodoItem['type'], string[]> = {
  medication: [
    '1. 対象利用者の本人確認を行う',
    '2. 服薬カレンダーまたは処方箋を確認',
    '3. 薬の種類・数量・服用方法を確認',
    '4. 利用者の体調を確認（発熱、嘔吐等）',
    '5. 服薬介助を実施',
    '6. 服薬記録に時刻・担当者名を記入',
    '7. 異常があれば看護師または管理者に報告',
  ],
  hospital: [
    '1. 予約票・診察券・保険証を準備',
    '2. お薬手帳と現在の服薬状況を確認',
    '3. 利用者の体調を確認（車酔い対策等）',
    '4. 車両の手配と運転者の確定',
    '5. 出発時刻の15分前に玄関集合',
    '6. 病院で医師の指示を正確に記録',
    '7. 帰施後、記録用紙に報告を記入',
  ],
  cleaning: [
    '1. 清掃箇所と作業内容を確認',
    '2. 必要な清掃用具と洗剤を準備',
    '3. 利用者の動線を確保（転倒防止）',
    '4. 作業開始前に周囲の職員に声かけ',
    '5. 清掃を実施',
    '6. 清掃後の点検（汚れ残り・破損チェック）',
    '7. チェックリストに完了署名',
  ],
  other: [
    '1. タスクの内容と目的を確認',
    '2. 必要な資料や情報を準備',
    '3. 関係者に事前連絡（必要に応じて）',
    '4. タスクを実施',
    '5. 完了後、記録または報告を行う',
  ],
};

/**
 * TodoDetailDialog Component
 */
export const TodoDetailDialog: React.FC<TodoDetailDialogProps> = ({
  open,
  onClose,
  todo,
  onOpenUserDetail,
}) => {
  if (!todo) {
    return null;
  }

  const typeConfig = TASK_TYPE_CONFIG[todo.type];
  const priorityConfig = PRIORITY_CONFIG[todo.priority];
  const actionList = ACTION_CHECKLIST[todo.type];

  // タイトルから利用者IDを抽出する試み（正規表現で「Aさん」「Bさん」を検出）
  const userIdMatch = todo.title.match(/([A-Z])さん/);
  const userId = userIdMatch ? userIdMatch[1] : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            sx={{
              bgcolor: typeConfig.color,
              width: 48,
              height: 48,
            }}
          >
            {typeConfig.icon}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" component="div">
              {todo.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {typeConfig.label}
            </Typography>
          </Box>
          <Chip
            label={priorityConfig.label}
            color={priorityConfig.color}
            size="small"
          />
        </Stack>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Stack spacing={3}>
          {/* 優先度の説明 */}
          {todo.priority === 'high' && (
            <Box
              sx={{
                p: 2,
                bgcolor: 'error.light',
                color: 'error.contrastText',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" fontWeight="bold">
                ⚠️ {priorityConfig.description}
              </Typography>
            </Box>
          )}

          {/* 期限と担当者 */}
          <Stack direction="row" spacing={3}>
            {todo.deadline && (
              <Stack direction="row" spacing={1} alignItems="center">
                <AccessTimeIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    期限時刻
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {todo.deadline}
                  </Typography>
                </Box>
              </Stack>
            )}
            {todo.assignee && (
              <Stack direction="row" spacing={1} alignItems="center">
                <PersonIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    担当者
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {todo.assignee}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Stack>

          <Divider />

          {/* アクションチェックリスト */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              実施手順
            </Typography>
            <List dense disablePadding>
              {actionList.map((action, index) => (
                <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckCircleOutlineIcon fontSize="small" color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={action}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* 関連利用者リンク */}
          {userId && onOpenUserDetail && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  関連情報
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<PersonIcon />}
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => {
                    onOpenUserDetail(userId);
                    onClose();
                  }}
                  sx={{ justifyContent: 'space-between' }}
                >
                  利用者 {userId}さんの詳細を確認
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};
