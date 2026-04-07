import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Stack, 
  Divider, 
  Button, 
  Alert, 
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { usePersistentDrift, type FieldSkipStreakResult } from '../hooks/usePersistentDrift';
import { useSP } from '@/lib/spClient';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'react-hot-toast';
import { auditLog } from '@/lib/debugLogger';
import { Link } from 'react-router-dom';
import { type SpFieldDef } from '@/lib/sp/types';

const REASON_KEY_TO_TITLE: Record<string, string> = {
  'users': 'Users_Master',
  'schedules': 'Schedules',
  'daily': 'DailyActivityRecords',
};

/**
 * Phase D.1: 整合性ドリフト解消のための「真の ensureField」用定義
 * 列が存在しない場合に作成するための型情報を持つ。
 */
const DRIFT_FIELD_DEFINITIONS: Record<string, SpFieldDef> = {
  'users:UserID': { internalName: 'UserID', displayName: 'ユーザーID', type: 'Text', indexed: true },
  'users:FullName': { internalName: 'FullName', displayName: '氏名', type: 'Text', indexed: true },
  'schedules:EventDate': { internalName: 'EventDate', displayName: '開始日時', type: 'DateTime', dateTimeFormat: 'DateTime', indexed: true },
  'schedules:EndDate': { internalName: 'EndDate', displayName: '終了日時', type: 'DateTime', dateTimeFormat: 'DateTime', indexed: true },
  'schedules:Status': { internalName: 'Status', displayName: 'ステータス', type: 'Text', indexed: true },
  'schedules:TargetUserId': { internalName: 'TargetUserId', displayName: '対象ユーザーID', type: 'Number', indexed: true },
  'schedules:AssignedStaffId': { internalName: 'AssignedStaffId', displayName: '担当職員ID', type: 'Number', indexed: true },
  'daily:RecordDate': { internalName: 'RecordDate', displayName: '記録日', type: 'DateTime', dateTimeFormat: 'DateOnly', indexed: true },
};

export const SpPersistentDriftPanel: React.FC = () => {
  const { persistentDrifts, loading, error } = usePersistentDrift();
  const sp = useSP();
  const confirm = useConfirmDialog();
  const [executingKeys, setExecutingKeys] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<Record<string, 'success' | 'error' | null>>({});

  const handleRepair = async (entry: FieldSkipStreakResult) => {
    const [listKey, fieldName] = entry.reasonKey.split(':');
    const listTitle = REASON_KEY_TO_TITLE[listKey] ?? listKey;

    confirm.open({
      title: 'フィールド・ドリフトの修復',
      message: `
対象リスト: ${listTitle}
対象フィールド: ${fieldName}
----------------------------------
・このフィールドは取得時に連続 ${entry.streak} 日間エラー（400スキップ）されています。
・このフィールドの構成（列の作成またはインデックス付与）を修復し、取得エラーの解消を試みます。

【影響】
・SharePoint 上でインデックスが作成されます。
・副作用はありませんが、もしインデックス上限（20個）に達している場合は失敗します。
      `.trim(),
      confirmLabel: '修復を実行する',
      warningText: '実行中にページを閉じないでください。',
      onConfirm: async () => {
        if (!sp) return;

        setExecutingKeys(prev => new Set(prev).add(entry.reasonKey));
        setResults(prev => ({ ...prev, [entry.reasonKey]: null }));

        try {
          auditLog.info('diagnostics:drift', `Executing persistent drift repair for ${entry.reasonKey}`, { listTitle, fieldName });
          
          // 1. 既存フィールドの存在確認
          const existingFields = await sp.getListFieldInternalNames(listTitle);
          const exists = existingFields.has(fieldName);

          if (!exists) {
            // A. 列が存在しない場合 -> 新規作成 (Field Existence Repair)
            const fieldDef = DRIFT_FIELD_DEFINITIONS[entry.reasonKey];
            if (fieldDef) {
              auditLog.info('diagnostics:drift', `Field ${fieldName} is missing. Creating...`, { listTitle });
              await sp.addFieldToList(listTitle, fieldDef);
              toast.success(`列を作成しました: ${fieldName} (${listTitle})`);
            } else {
              throw new Error(`未知のフィールド定義です。手動で作成してください: ${fieldName}`);
            }
          } else {
            // B. 列が存在する場合 -> インデックス設定の更新 (Index Repair)
            auditLog.info('diagnostics:drift', `Field ${fieldName} exists. Ensuring indexed status.`, { listTitle });
            await sp.updateField(listTitle, fieldName, { Indexed: true });
            toast.success(`インデックスを付与しました: ${fieldName} (${listTitle})`);
          }
          
          setResults(prev => ({ ...prev, [entry.reasonKey]: 'success' }));
        } catch (err) {
          auditLog.error('diagnostics:drift', `Repair failed for ${entry.reasonKey}`, err);
          setResults(prev => ({ ...prev, [entry.reasonKey]: 'error' }));
          toast.error(`修復失敗: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setExecutingKeys(prev => {
            const next = new Set(prev);
            next.delete(entry.reasonKey);
            return next;
          });
        }
      }
    });
  };

  if (loading && persistentDrifts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 永続ドリフトが存在しない場合は表示しない（健康な状態）
  if (persistentDrifts.length === 0) {
    return null;
  }

  const hasAnySuccess = Object.values(results).some(v => v === 'success');

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 3, 
        my: 4, 
        borderColor: 'warning.light', 
        bgcolor: '#fffbf0', // 薄い警告背景
        borderRadius: 2,
        animation: 'fadeIn 0.5s ease-out'
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <WarningAmberIcon color="warning" />
        <Typography variant="h6" color="warning.dark" fontWeight="bold">
          永続的な不整合（Persistent Drift）の検知
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Nightly Patrol により ${persistentDrifts.length} 件のデータ取得失敗（スキップ）が継続して記録されています。<br />
        システムの整合性を保つため、対象フィールドの構成（列の作成またはインデックス設定）を修復することを推奨します。
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        {persistentDrifts.map((entry, idx) => {
          const isExecuting = executingKeys.has(entry.reasonKey);
          const result = results[entry.reasonKey];
          const [listKey, fieldName] = entry.reasonKey.split(':');
          const listTitle = REASON_KEY_TO_TITLE[listKey] ?? listKey;

          return (
            <React.Fragment key={entry.reasonKey}>
              {idx > 0 && <Divider />}
              <ListItem 
                sx={{ 
                  py: 2,
                  bgcolor: isExecuting ? 'action.hover' : 'inherit'
                }}
              >
                <ListItemIcon>
                  {result === 'success' ? (
                    <CheckCircleOutlineIcon color="success" />
                  ) : result === 'error' ? (
                    <ErrorOutlineIcon color="error" />
                  ) : (
                    <BuildCircleIcon color="warning" />
                  )}
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        {fieldName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ bgcolor: 'action.selected', px: 1, borderRadius: 0.5 }}>
                        {listTitle}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                      ⚠ ${entry.streak}日連続でスキップされています
                    </Typography>
                  }
                />
                
                <Box sx={{ ml: 2 }}>
                  {result === 'success' ? (
                    <Typography variant="caption" color="success.main" fontWeight="bold">
                      修復済み
                    </Typography>
                  ) : (
                    <Tooltip title="列の構成（作成またはインデックス付与）を修復し、取得エラーを解消します">
                      <span>
                        <Button 
                          variant="contained" 
                          size="small" 
                          color="warning"
                          startIcon={isExecuting ? <CircularProgress size={16} color="inherit" /> : <BuildCircleIcon />}
                          disabled={isExecuting || !sp}
                          onClick={() => handleRepair(entry)}
                          sx={{ textTransform: 'none' }}
                        >
                          {isExecuting ? '実行中...' : '修復を実行'}
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                </Box>
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>

      {hasAnySuccess && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            修復が完了しました。整合性を再確認するためにデータ整合性ダッシュボードで「スキャンを再実行」してください。
          </Typography>
          <Button 
            component={Link} 
            to="/admin/data-integrity" 
            variant="outlined" 
            size="small" 
            color="success"
            sx={{ fontWeight: 'bold' }}
          >
            データ整合性 Dashboard へ
          </Button>
        </Alert>
      )}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Typography variant="caption" color="text.disabled">
          Data source: Diagnostics_Reports (SharePoint)
        </Typography>
      </Box>

      <ConfirmDialog {...confirm.dialogProps} />
    </Paper>
  );
};
