import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Stack,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Print as PrintIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Payments as PaymentsIcon,
  Coffee as CoffeeIcon,
  CurrencyYen as YenIcon,
  AccountCircle as AccountCircleIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useBillingSummary } from '../hooks/useBillingSummary';
import type { BillingOrderRepository } from '../ports/billingOrderRepository';

type ActiveTab = '利用者' | '職員' | 'ゲスト' | 'すべて';

const toMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const addMonths = (monthKey: string, offset: number): string => {
  const [year, month] = monthKey.split('-').map(Number);
  return toMonthKey(new Date(year, month - 1 + offset, 1));
};

const buildMonthOptions = (availableMonths: string[], selectedMonth: string): string[] => {
  const currentMonth = toMonthKey(new Date());
  const months = new Set([selectedMonth, currentMonth, ...availableMonths]);

  for (let offset = -24; offset <= 3; offset += 1) {
    months.add(addMonths(currentMonth, offset));
  }

  return Array.from(months)
    .filter((month) => /^\d{4}-\d{2}$/.test(month))
    .sort((a, b) => b.localeCompare(a));
};

export type BillingPageProps = {
  readonly repository: BillingOrderRepository;
};

export default function BillingPage({ repository }: BillingPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(new Date()));
  const [hasUserSelectedMonth, setHasUserSelectedMonth] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('利用者');

  // カスタムフックから集計データとコントロール関数を取得
  const {
    records,
    availableMonths,
    totalServedCount,
    totalServedAmount,
    totalPaidCount,
    totalUnpaidAmount,
    isLoading,
    isError,
    isMutating,
    isPersistenceMissing,
    isPaymentAuditMissing,
    canEditPayment,
    hasLocalPaymentState,
    localPaymentStateCount,
    persistenceWarningReason,
    togglePaymentStatus,
    bulkSettle,
    exportCsv,
  } = useBillingSummary(selectedMonth, repository);

  useEffect(() => {
    if (!hasUserSelectedMonth && availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, hasUserSelectedMonth, selectedMonth]);

  const monthOptions = useMemo(() => {
    return buildMonthOptions(availableMonths, selectedMonth);
  }, [availableMonths, selectedMonth]);

  // 表示対象のレコードをタブでフィルタ
  const filteredRecords = React.useMemo(() => {
    if (activeTab === 'すべて') return records;
    return records.filter((r) => r.category === activeTab);
  }, [records, activeTab]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: ActiveTab) => {
    setActiveTab(newValue);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (isPersistenceMissing) {
      const shouldExport = window.confirm(
        '精算状態の永続化列を確認できないため、このCSVには端末内の一時的な精算状態が含まれる可能性があります。正式な精算CSVとして扱わないでください。それでもCSVを出力しますか？'
      );
      if (!shouldExport) return;
    }
    exportCsv(activeTab);
  };

  // 通貨フォーマット
  const formatYen = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4, px: { xs: 2, md: 4 } }} className="billing-container" data-testid="billing-root">
      {/* 印刷用ヘッダー (画面上は非表示) */}
      <Box
        className="print-only"
        sx={{
          display: 'none',
          '@media print': {
            display: 'block',
            mb: 4,
            borderBottom: '2px solid #334155',
            pb: 2,
          },
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
          コーヒー注文請求集計表 ({selectedMonth})
        </Typography>
        <Typography variant="subtitle1" sx={{ color: '#64748b', mt: 1 }}>
          出力対象区分: {activeTab} | 出力日時: {new Date().toLocaleDateString('ja-JP')}
        </Typography>
        <Stack direction="row" spacing={4} sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b' }}>提供数合計</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{totalServedCount} 杯</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b' }}>請求金額合計</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f766e' }}>{formatYen(totalServedAmount)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b' }}>未精算残高</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>{formatYen(totalUnpaidAmount)}</Typography>
          </Box>
        </Stack>
      </Box>

      {/* 画面用ヘッダー & コントロール (印刷時非表示) */}
      <Box sx={{ '@media print': { display: 'none' } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="flex-end"
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
          sx={{ mb: 4 }}
        >
          {/* コントロールパネル */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="month-select-label">対象月</InputLabel>
              <Select
                labelId="month-select-label"
                value={selectedMonth}
                label="対象月"
                onChange={(e) => {
                  setHasUserSelectedMonth(true);
                  setSelectedMonth(e.target.value);
                }}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(20, 184, 166, 0.2)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(20, 184, 166, 0.5)',
                  },
                }}
              >
                {monthOptions.map((month) => {
                  const [year, monthNumber] = month.split('-');
                  return (
                    <MenuItem key={month} value={month}>
                      {year}年{Number(monthNumber)}月
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              color="primary"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                borderColor: 'rgba(20, 184, 166, 0.4)',
                color: '#0f766e',
                fontWeight: 600,
                px: 2.5,
                '&:hover': {
                  borderColor: '#14b8a6',
                  bgcolor: 'rgba(20, 184, 166, 0.05)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              印刷
            </Button>

            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExportCsv}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                bgcolor: '#0d9488',
                backgroundImage: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
                fontWeight: 600,
                px: 2.5,
                '&:hover': {
                  bgcolor: '#0f766e',
                  boxShadow: '0 6px 20px rgba(13, 148, 136, 0.4)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              CSV出力
            </Button>
            {isPersistenceMissing && (
              <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600 }}>
                精算状態未検証のため、CSV出力時に確認が必要です
              </Typography>
            )}
          </Stack>
        </Stack>

        {/* グラスモルフィズム KPI サマリーカード */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* KPI 1: 提供済み杯数 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.06)',
                borderRadius: 3,
                transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 12px 40px 0 rgba(15, 23, 42, 0.1)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600, mb: 1 }}>
                      提供済み総数
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b' }}>
                      {isLoading ? <CircularProgress size={24} /> : `${totalServedCount} 杯`}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: 'rgba(20, 184, 166, 0.1)',
                      color: '#0d9488',
                      display: 'flex',
                    }}
                  >
                    <CoffeeIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* KPI 2: 請求対象金額 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.06)',
                borderRadius: 3,
                transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 12px 40px 0 rgba(15, 23, 42, 0.1)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600, mb: 1 }}>
                      合計請求金額
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#0d9488' }}>
                      {isLoading ? <CircularProgress size={24} /> : formatYen(totalServedAmount)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: 'rgba(20, 184, 166, 0.1)',
                      color: '#0d9488',
                      display: 'flex',
                    }}
                  >
                    <YenIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* KPI 3: 精算済み杯数 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.06)',
                borderRadius: 3,
                transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 12px 40px 0 rgba(15, 23, 42, 0.1)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600, mb: 1 }}>
                      精算済み数
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981' }}>
                      {isLoading ? (
                        <CircularProgress size={24} />
                      ) : (
                        `${totalPaidCount} / ${totalServedCount} 杯`
                      )}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      display: 'flex',
                    }}
                  >
                    <CheckCircleIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* KPI 4: 未精算金額 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.06)',
                borderRadius: 3,
                transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 12px 40px 0 rgba(15, 23, 42, 0.1)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600, mb: 1 }}>
                      未精算金額
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                      {isLoading ? <CircularProgress size={24} /> : formatYen(totalUnpaidAmount)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: 'rgba(245, 158, 11, 0.1)',
                      color: '#d97706',
                      display: 'flex',
                    }}
                  >
                    <PaymentsIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* エラーアラート */}
      {isError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          請求データの読み込みに失敗しました。SharePoint またはネットワークの状態をご確認ください。
        </Alert>
      )}

      {isPersistenceMissing && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          精算状態の永続化列を確認できません。現在の精算状態には、この端末・このブラウザ内の一時情報が含まれる可能性があります。別端末・別ブラウザでは一致しない場合があるため、CSVの精算状況を正式な精算結果として扱わないでください。管理者は SharePoint の PaymentStatus / PaidAt / PaidBy 列を確認してください。
          {persistenceWarningReason && (
            <>
              <br />
              {persistenceWarningReason}
            </>
          )}
        </Alert>
      )}

      {!isPersistenceMissing && isPaymentAuditMissing && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          精算状態は SharePoint に保存できますが、PaidAt / PaidBy などの監査情報列を一部確認できません。管理者は SharePoint の PaymentStatus / PaidAt / PaidBy 列を確認してください。
          {persistenceWarningReason && (
            <>
              <br />
              {persistenceWarningReason}
            </>
          )}
        </Alert>
      )}

      {hasLocalPaymentState && (
        <Alert severity={isPersistenceMissing ? 'warning' : 'info'} sx={{ mb: 3, borderRadius: 2 }}>
          {isPersistenceMissing ? (
            <>
              端末内の一時状態が表示やCSVへ影響する可能性があります。
              <br />
              端末内一時状態: {localPaymentStateCount}件
            </>
          ) : (
            <>
              端末内の過去一時状態が残っていますが、現在は SharePoint の精算状態を正本として表示しています。
              <br />
              端末内一時状態: {localPaymentStateCount}件
            </>
          )}
        </Alert>
      )}

      {isMutating && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5, mb: 3, bgcolor: 'rgba(20, 184, 166, 0.08)', borderRadius: 2, border: '1px solid rgba(20, 184, 166, 0.2)' }}>
          <CircularProgress size={20} color="primary" />
          <Typography sx={{ ml: 1.5, fontSize: '0.9rem', color: '#0f766e', fontWeight: 600 }}>
            精算状態を更新しています...
          </Typography>
        </Box>
      )}

      {/* メインテーブル & タブ */}
      <Card
        sx={{
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          background: '#ffffff',
          '@media print': {
            border: 'none',
            boxShadow: 'none',
          },
        }}
      >
        {/* 画面用タブ & 一括ボタン (印刷時非表示) */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 3,
            py: 1.5,
            bgcolor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            '@media print': { display: 'none' },
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                bgcolor: '#0d9488',
              },
              '& .MuiTab-root': {
                fontWeight: 600,
                fontSize: '0.95rem',
                textTransform: 'none',
                minWidth: 100,
                color: '#64748b',
                '&.Mui-selected': {
                  color: '#0d9488',
                },
              },
            }}
          >
            <Tab label="利用者" value="利用者" />
            <Tab label="職員" value="職員" />
            <Tab label="ゲスト" value="ゲスト" />
            <Tab label="すべて" value="すべて" />
          </Tabs>

          {canEditPayment && (
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<CheckIcon />}
              disabled={filteredRecords.length === 0 || isMutating}
              onClick={() => {
                if (window.confirm(`「${activeTab}」の未精算データをすべて精算済みにしますか？`)) {
                  bulkSettle(activeTab);
                }
              }}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 2,
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: '#059669',
                '&:hover': {
                  borderColor: '#10b981',
                  bgcolor: 'rgba(16, 185, 129, 0.05)',
                },
              }}
            >
              選択中のタブを一括精算
            </Button>
          )}
        </Box>

        {/* 集計テーブル */}
        <TableContainer>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress color="primary" />
              <Typography sx={{ ml: 2, color: '#64748b', fontWeight: 500 }}>データを集計中...</Typography>
            </Box>
          ) : filteredRecords.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, px: 2 }}>
              <Typography variant="h6" sx={{ color: '#64748b', fontWeight: 600, mb: 1 }}>
                該当する注文データはありません
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                選択した対象月 ({selectedMonth}) において、提供済みのコーヒー注文が見つかりませんでした。
              </Typography>
            </Box>
          ) : (
            <Table
              sx={{
                minWidth: 650,
                '& .MuiTableCell-head': {
                  fontWeight: 700,
                  bgcolor: '#f8fafc',
                  color: '#334155',
                  py: 2,
                  borderBottom: '2px solid #e2e8f0',
                },
                '& .MuiTableCell-body': {
                  py: 1.5,
                  color: '#475569',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>注文者コード</TableCell>
                  <TableCell>注文者氏名</TableCell>
                  <TableCell>区分</TableCell>
                  <TableCell align="right">提供数</TableCell>
                  <TableCell align="right">請求金額</TableCell>
                  <TableCell align="center" sx={{ '@media print': { display: 'none' } }}>
                    精算状況
                  </TableCell>
                  <TableCell align="center" className="print-only" sx={{ display: 'none', '@media print': { display: 'table-cell' } }}>
                    サイン・確認
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.map((record) => {
                  const badgeColor =
                    record.category === '利用者'
                      ? 'primary'
                      : record.category === '職員'
                      ? 'secondary'
                      : 'default';
                  const paymentStatusChip = record.isPaid ? (
                    <Chip
                      icon={<CheckCircleIcon sx={{ color: '#10b981 !important' }} />}
                      label="精算済み"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                        color: '#047857',
                        fontWeight: 600,
                        cursor: canEditPayment ? 'pointer' : 'default',
                      }}
                    />
                  ) : (
                    <Chip
                      icon={<UncheckedIcon sx={{ color: '#ef4444 !important' }} />}
                      label="未精算"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(239, 68, 68, 0.08)',
                        color: '#b91c1c',
                        fontWeight: 600,
                        cursor: canEditPayment ? 'pointer' : 'default',
                      }}
                    />
                  );

                  return (
                    <TableRow
                      key={record.ordererCode}
                      sx={{
                        '&:hover': {
                          bgcolor: 'rgba(248, 250, 252, 0.6)',
                        },
                        transition: 'background-color 0.2s',
                        '@media print': {
                          pageBreakInside: 'avoid',
                        },
                      }}
                    >
                      {/* コード */}
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {record.ordererCode}
                      </TableCell>

                      {/* 氏名 */}
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <AccountCircleIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {record.ordererName}
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* 区分バッジ */}
                      <TableCell>
                        <Chip
                          label={record.category}
                          size="small"
                          color={badgeColor}
                          variant="outlined"
                          sx={{
                            fontWeight: 600,
                            borderRadius: '6px',
                            px: 0.5,
                          }}
                        />
                      </TableCell>

                      {/* 提供数 */}
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {record.totalCount} 杯
                      </TableCell>

                      {/* 金額 */}
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#0f766e' }}>
                        {formatYen(record.totalAmount)}
                      </TableCell>

                      {/* アクション (画面用精算トグル) */}
                      <TableCell align="center" sx={{ '@media print': { display: 'none' } }}>
                        {canEditPayment ? (
                          <Button
                            variant="text"
                            disabled={isMutating}
                            onClick={() => togglePaymentStatus(record.ordererCode)}
                            sx={{
                              textTransform: 'none',
                              py: 0.5,
                              px: 1.5,
                              borderRadius: 2,
                              transition: 'all 0.2s',
                            }}
                          >
                            {paymentStatusChip}
                          </Button>
                        ) : (
                          paymentStatusChip
                        )}
                      </TableCell>

                      {/* 印刷用受領欄 (紙で署名・確認するための列) */}
                      <TableCell
                        align="center"
                        className="print-only"
                        sx={{
                          display: 'none',
                          '@media print': {
                            display: 'table-cell',
                            borderBottom: '1px solid #cbd5e1',
                            width: 150,
                          },
                        }}
                      >
                        <Box sx={{ border: '1px solid #cbd5e1', height: 32, borderRadius: 1, mx: 'auto', width: 100 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Card>

      {/* 印刷時の用紙設定及びスタイル強制用 */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          @page {
            size: landscape;
            margin: 15mm;
          }
          .billing-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            width: 100% !important;
          }
          /* MUI Paper or Card printing backgrounds */
          .MuiPaper-root {
            background-color: transparent !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </Container>
  );
}
