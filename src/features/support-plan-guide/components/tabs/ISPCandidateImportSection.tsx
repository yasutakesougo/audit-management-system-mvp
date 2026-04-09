/**
 * ISPCandidateImportSection — 行動パターン候補の取り込みセクション
 *
 * Issue #10 Phase 2: SupportPlanGuide への接続
 *
 * ExcellenceTab 内に配置し、日次記録から accept された提案を
 * ISP 候補として improvementIdeas に一括取り込む。
 *
 * UX パターンは MonitoringEvidenceSection の「エビデンス引用」と統一。
 *
 * @see src/features/daily/domain/ispCandidateMapper.ts — pure functions
 * @see src/features/support-plan-guide/hooks/useAcceptedSuggestionsForUser.ts — データ取得
 */

import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

import {
  appendCandidateToImprovementIdeas,
  collectISPCandidates,
  isAlreadyInImprovementIdeas,
} from '@/features/daily/domain/mappers/ispCandidateMapper';
import type { ToastState } from '../../types';
import { useAcceptedSuggestionsForUser } from '../../hooks/useAcceptedSuggestionsForUser';

// ─── Props ───────────────────────────────────────────────

export type ISPCandidateImportSectionProps = {
  /** 対象利用者ID */
  userId: string;
  /** 現在の improvementIdeas テキスト */
  currentImprovementIdeas: string;
  /** フィールド変更ハンドラ（既存の handleFieldChange） */
  onFieldChange: (key: 'improvementIdeas', value: string) => void;
  /** 管理者権限フラグ */
  isAdmin: boolean;
  /** Toast 表示 */
  setToast: (toast: ToastState) => void;
};

// ─── Component ───────────────────────────────────────────

const ISPCandidateImportSection: React.FC<ISPCandidateImportSectionProps> = ({
  userId,
  currentImprovementIdeas,
  onFieldChange,
  isAdmin,
  setToast,
}) => {
  // (1) データ取得（Phase 2: スタブ / Phase 3: SP連携）
  const { items: suggestions, isLoading } = useAcceptedSuggestionsForUser(userId);

  // (2) 候補生成（pure function — Phase 1 のロジックをそのまま使用）
  const candidates = useMemo(
    () => collectISPCandidates(suggestions, []),
    [suggestions],
  );

  // (3) 未追記候補のフィルタ（3層目の重複防止）
  const newCandidates = useMemo(
    () => candidates.filter(
      c => !isAlreadyInImprovementIdeas(currentImprovementIdeas, c.sourceRuleId, c.userId),
    ),
    [candidates, currentImprovementIdeas],
  );

  // (4) Loading 中は表示しない
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          候補を確認中…
        </Typography>
      </Box>
    );
  }

  // (5) 候補がなければ非表示（ノイズ削減）
  if (newCandidates.length === 0) return null;

  // (6) まとめて取り込みハンドラ
  const handleImport = () => {
    let text = currentImprovementIdeas;
    for (const candidate of newCandidates) {
      text = appendCandidateToImprovementIdeas(text, candidate);
    }
    onFieldChange('improvementIdeas', text);
    setToast({
      open: true,
      message: `${newCandidates.length}件の候補を改善メモに取り込みました`,
      severity: 'success',
    });
  };

  // (7) goalType ラベル変換
  const goalTypeLabel = (type: 'short' | 'support') =>
    type === 'short' ? '短期目標候補' : '支援内容候補';

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={1.5}>
          {/* ヘッダー行 */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <LightbulbRoundedIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" component="span" color="primary">
                行動パターンからの個別支援計画候補 ({newCandidates.length}件)
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleImport}
              disabled={!isAdmin}
              data-testid="isp-candidate-import-button"
            >
              候補を取り込む {newCandidates.length}件
            </Button>
          </Stack>

          {/* 補足説明 */}
          <Typography variant="caption" color="text.secondary">
            ※ 日々の記録で採用された提案から自動生成された候補です。改善メモに取り込んだ後、内容を調整してください。
          </Typography>

          {/* 候補プレビューリスト */}
          <Box
            sx={{
              maxHeight: 200,
              overflowY: 'auto',
              bgcolor: 'background.paper',
              borderRadius: 1,
              p: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <List dense disablePadding>
              {newCandidates.map((candidate) => (
                <ListItem key={candidate.id} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={candidate.text}
                    secondary={`根拠: ${candidate.sourceEvidence} → ${goalTypeLabel(candidate.suggestedGoalType)}`}
                    primaryTypographyProps={{
                      variant: 'caption',
                      sx: { display: 'block', lineHeight: 1.4 },
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      color: 'text.secondary',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

export default React.memo(ISPCandidateImportSection);
