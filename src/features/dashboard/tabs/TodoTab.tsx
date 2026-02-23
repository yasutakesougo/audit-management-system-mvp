/**
 * Todo Tab (やることタブ)
 * 
 * 目的：今日やるべきタスクを優先度順に表示
 * 
 * 表示内容：
 * - 服薬介助が必要な利用者
 * - 通院同行の予定
 * - 特別清掃・点検項目
 * - その他の期限付きタスク
 * 
 * Phase C-2 Final:
 * - TodoDetailDialog との統合
 * - クリックで詳細手順を表示
 * - 利用者詳細へのリンク
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import MedicationIcon from '@mui/icons-material/Medication';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { TodoDetailDialog } from '@/features/dashboard/dialogs/TodoDetailDialog';
import { UserDetailDialog, type UserDetail } from '@/features/dashboard/dialogs/UserDetailDialog';

export interface TodoItem {
  id: string;
  /** タスクのタイトル */
  title: string;
  /** タスクの種類 */
  type: 'medication' | 'hospital' | 'cleaning' | 'other';
  /** 期限時刻（例: "10:00"） */
  deadline?: string;
  /** 担当者名 */
  assignee?: string;
  /** 優先度（high: 赤、medium: 黄、low: グレー） */
  priority: 'high' | 'medium' | 'low';
}

export interface TodoTabProps {
  /** タスクリスト */
  todos: TodoItem[];
}

/**
 * タスク種別の設定
 */
const TASK_TYPE_CONFIG = {
  medication: {
    icon: <MedicationIcon />,
    label: '服薬介助',
    color: 'primary',
  },
  hospital: {
    icon: <LocalHospitalIcon />,
    label: '通院同行',
    color: 'info',
  },
  cleaning: {
    icon: <CleaningServicesIcon />,
    label: '清掃・点検',
    color: 'success',
  },
  other: {
    icon: <AssignmentIcon />,
    label: 'その他',
    color: 'default',
  },
} as const;

/**
 * 優先度の色設定
 */
const PRIORITY_CONFIG = {
  high: {
    color: 'error',
    label: '高',
  },
  medium: {
    color: 'warning',
    label: '中',
  },
  low: {
    color: 'default',
    label: '低',
  },
} as const;

/**
 * やることタブコンテンツ
 * 今日の優先タスクを時系列で表示
 */
export const TodoTab: React.FC<TodoTabProps> = ({ todos }) => {
  // モーダル状態管理（Todo詳細）
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [isTodoDetailOpen, setIsTodoDetailOpen] = useState(false);

  // モーダル状態管理（利用者詳細）
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);

  // タスククリック時のハンドラ
  const handleTodoClick = (todo: TodoItem) => {
    setSelectedTodo(todo);
    setIsTodoDetailOpen(true);
  };

  // Todo詳細モーダルを閉じる
  const handleCloseTodoDetail = () => {
    setIsTodoDetailOpen(false);
    setSelectedTodo(null);
  };

  // 利用者詳細を開く（TodoDetailDialogから呼ばれる）
  const handleOpenUserDetail = (userId: string) => {
    // Mock data：実際のデータから取得する
    const userDetail: UserDetail = {
      id: userId,
      name: `${userId}さん`,
      status: 'present', // TODO: 実データから取得
      vitals: {
        bloodPressure: '120/80',
        pulse: 72,
        temperature: 36.5,
      },
      emergencyContacts: [
        {
          relationship: '家族',
          name: '連絡先未登録',
          phone: '-',
        },
      ],
      notes: '詳細情報は記録を参照してください',
    };
    setSelectedUser(userDetail);
    setIsUserDetailOpen(true);
  };

  // 利用者詳細モーダルを閉じる
  const handleCloseUserDetail = () => {
    setIsUserDetailOpen(false);
    setSelectedUser(null);
  };

  // 優先度でソート（high → medium → low）
  const sortedTodos = [...todos].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // タスク数を種類別にカウント
  const taskCounts = {
    medication: todos.filter(t => t.type === 'medication').length,
    hospital: todos.filter(t => t.type === 'hospital').length,
    cleaning: todos.filter(t => t.type === 'cleaning').length,
    other: todos.filter(t => t.type === 'other').length,
  };

  return (
    <Box>
      {/* サマリー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          ✅ 本日のタスク
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          全 {todos.length} 件のタスクがあります
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {taskCounts.medication > 0 && (
            <Chip
              icon={<MedicationIcon />}
              label={`服薬: ${taskCounts.medication}件`}
              size="small"
              color="primary"
            />
          )}
          {taskCounts.hospital > 0 && (
            <Chip
              icon={<LocalHospitalIcon />}
              label={`通院: ${taskCounts.hospital}件`}
              size="small"
              color="info"
            />
          )}
          {taskCounts.cleaning > 0 && (
            <Chip
              icon={<CleaningServicesIcon />}
              label={`清掃: ${taskCounts.cleaning}件`}
              size="small"
              color="success"
            />
          )}
          {taskCounts.other > 0 && (
            <Chip
              icon={<AssignmentIcon />}
              label={`その他: ${taskCounts.other}件`}
              size="small"
            />
          )}
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* タスクリスト */}
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
          タスク一覧（優先度順）
        </Typography>
        {sortedTodos.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
            本日のタスクはありません
          </Typography>
        ) : (
          <List>
            {sortedTodos.map((todo) => {
              const typeConfig = TASK_TYPE_CONFIG[todo.type];
              const priorityConfig = PRIORITY_CONFIG[todo.priority];
              return (
                <ListItem
                  key={todo.id}
                  onClick={() => handleTodoClick(todo)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      bgcolor: 'action.hover',
                      cursor: 'pointer',
                      transform: 'translateX(4px)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ListItemIcon sx={{ color: `${typeConfig.color}.main` }}>
                    {typeConfig.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {todo.title}
                        </Typography>
                        <Chip
                          label={priorityConfig.label}
                          size="small"
                          color={priorityConfig.color}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        {todo.deadline && `期限: ${todo.deadline}`}
                        {todo.assignee && ` | 担当: ${todo.assignee}`}
                      </>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* タスク詳細モーダル */}
      <TodoDetailDialog
        open={isTodoDetailOpen}
        onClose={handleCloseTodoDetail}
        todo={selectedTodo}
        onOpenUserDetail={handleOpenUserDetail}
      />

      {/* 利用者詳細モーダル */}
      <UserDetailDialog
        open={isUserDetailOpen}
        onClose={handleCloseUserDetail}
        user={selectedUser}
      />
    </Box>
  );
};
