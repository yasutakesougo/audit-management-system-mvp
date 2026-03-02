// ---------------------------------------------------------------------------
// InterventionDashboardPage — 行動対応プラン マスター・ディテール (A-Layer)
//
// 左ペイン: 対象行動リスト（マスター）
// 右ペイン: 3列介入戦略フォーム（ディテール）
// ヘッダー: 氷山からの自動生成ボタン + ユーザー選択
// ---------------------------------------------------------------------------
import InterventionStrategyForm from '@/features/analysis/components/InterventionStrategyForm';
import { getIncompleteStrategies, STRATEGY_LABELS } from '@/features/analysis/domain/interventionTypes';
import { useInterventionDashboard } from '@/features/analysis/hooks/useInterventionDashboard';
import { useIcebergStore } from '@/features/ibd/analysis/iceberg/icebergStore';
import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrintIcon from '@mui/icons-material/Print';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const InterventionDashboardPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    targetUserId,
    plans,
    selectedPlanId,
    selectedPlan,
    setTargetUserId,
    selectPlan,
    updateStrategy,
    generateFromIceberg,
    save,
    removePlan,
  } = useInterventionDashboard();

  const { currentSession } = useIcebergStore();
  const { data: users } = useUsersDemo();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // ---- handlers ----
  const handleUserChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      setTargetUserId(e.target.value);
    },
    [setTargetUserId],
  );

  const handleGenerate = useCallback(() => {
    if (!currentSession) {
      setSnackbar({ open: true, message: '氷山セッションがありません。先に氷山モデル分析を実行してください。' });
      return;
    }
    if (currentSession.targetUserId !== targetUserId) {
      setSnackbar({ open: true, message: '氷山セッションのユーザーが一致しません。' });
      return;
    }
    const count = generateFromIceberg(currentSession);
    if (count > 0) {
      setSnackbar({ open: true, message: `${count}件の行動対応プランを生成しました` });
    } else {
      setSnackbar({ open: true, message: 'すべて生成済みです（新しい行動はありません）' });
    }
  }, [currentSession, targetUserId, generateFromIceberg]);

  const handleSave = useCallback(() => {
    save();
    setSnackbar({ open: true, message: '保存しました 💾' });
  }, [save]);

  const handleSelectPlan = useCallback(
    (planId: string) => {
      selectPlan(planId);
      if (isMobile) setMobileDrawerOpen(false);
    },
    [selectPlan, isMobile],
  );

  // ---- Master list ----
  const masterList = (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      data-testid="intervention-master-list"
    >
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700}>
          対象行動一覧
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {plans.length}件のプラン
        </Typography>
      </Box>
      <List dense sx={{ flex: 1, overflow: 'auto' }}>
        {plans.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              プランがありません
            </Typography>
            <Typography variant="caption" color="text.secondary">
              「氷山から生成」ボタンでプランを作成してください
            </Typography>
          </Box>
        ) : (
          plans.map((plan) => {
            const incomplete = getIncompleteStrategies(plan);
            return (
              <ListItemButton
                key={plan.id}
                selected={plan.id === selectedPlanId}
                onClick={() => handleSelectPlan(plan.id)}
                sx={{
                  borderLeft: 4,
                  borderLeftColor: plan.id === selectedPlanId ? 'primary.main' : 'transparent',
                }}
                data-testid={`plan-item-${plan.id}`}
              >
                <Badge
                  color="error"
                  variant="dot"
                  invisible={incomplete.length === 0}
                  sx={{ '& .MuiBadge-dot': { top: 6, right: -4 } }}
                >
                  <ListItemText
                    primary={plan.targetBehavior}
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {plan.triggerFactors.slice(0, 2).map((f) => (
                            <Chip key={f.nodeId} label={f.label} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                          ))}
                          {plan.triggerFactors.length > 2 && (
                            <Chip label={`+${plan.triggerFactors.length - 2}`} size="small" />
                          )}
                        </Stack>
                        {incomplete.length > 0 && (
                          <Chip
                            label={`未入力: ${incomplete.map((f) => STRATEGY_LABELS[f]).join('・')}`}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 20, alignSelf: 'flex-start' }}
                          />
                        )}
                      </Stack>
                    }
                  />
                </Badge>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePlan(plan.id);
                  }}
                  sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            );
          })
        )}
      </List>
    </Paper>
  );

  // ---- Detail pane ----
  const detailPane = selectedPlan ? (
    <Box className="bip-detail-pane">
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }} className="bip-print-actions">
        <IconButton
          size="small"
          onClick={() => window.print()}
          title="印刷"
          sx={{ color: 'text.secondary' }}
        >
          <PrintIcon fontSize="small" />
        </IconButton>
      </Stack>
      <InterventionStrategyForm
        plan={selectedPlan}
        onUpdate={(field, value) => updateStrategy(selectedPlan.id, field, value)}
      />
    </Box>
  ) : (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
      }}
    >
      <Stack spacing={1} alignItems="center">
        <AcUnitIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="body1" color="text.secondary">
          左のリストから対象行動を選択してください
        </Typography>
      </Stack>
    </Paper>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }} data-testid="intervention-dashboard-page">
      {/* Print-only CSS */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body > *:not(#root) { display: none !important; }
          header, nav, .MuiDrawer-root, .MuiAppBar-root,
          [data-testid="intervention-master-list"],
          .bip-print-actions,
          footer { display: none !important; }
          .bip-detail-pane {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          [data-testid="intervention-strategy-form"] {
            border: 1px solid #ccc !important;
            break-inside: avoid;
          }
        }
      `}</style>
      <IBDPageHeader
        title="行動対応プラン"
        subtitle="氷山モデルの因果リンクから If-Then 形式の介入戦略を設計する"
        icon={<AutoFixHighIcon />}
        actions={
          <>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="intervention-user-select-label">対象者</InputLabel>
              <Select
                labelId="intervention-user-select-label"
                label="対象者"
                value={targetUserId}
                displayEmpty
                onChange={handleUserChange}
              >
                <MenuItem value="">
                  <em>対象者を選択</em>
                </MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.UserID} value={user.UserID}>
                    {user.FullName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<AcUnitIcon />}
              onClick={handleGenerate}
              disabled={!targetUserId}
            >
              氷山から生成
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={plans.length === 0}
            >
              保存
            </Button>
          </>
        }
      />

      {!targetUserId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          上部のドロップダウンから対象利用者を選択してください
        </Alert>
      )}

      {targetUserId && (
        <>
          {/* Desktop: side-by-side */}
          {!isMobile ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                gap: 2,
                minHeight: 500,
              }}
            >
              {masterList}
              {detailPane}
            </Box>
          ) : (
            <>
              {/* Mobile: show master list, detail in drawer */}
              <Button
                fullWidth
                variant="outlined"
                sx={{ mb: 2 }}
                onClick={() => setMobileDrawerOpen(true)}
              >
                対象行動を選択（{plans.length}件）
              </Button>
              <Drawer
                anchor="left"
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                PaperProps={{ sx: { width: 300 } }}
              >
                {masterList}
              </Drawer>
              {detailPane}
            </>
          )}
        </>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
        行動対応プランは現在ローカルストレージに保存されます。SharePoint連携は今後のフェーズで追加予定です。
      </Typography>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default InterventionDashboardPage;
