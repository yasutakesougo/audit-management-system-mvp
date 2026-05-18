/**
 * ImportTemplateDialog — SupportTemplate CSV / 静的マスタ → ProcedureStep 取り込みダイアログ
 *
 * EditablePlanningDesignSection から開かれ、
 * 内蔵の標準テンプレート（USER_PROCEDURE_DETAILS）またはCSVファイルからプレビューし、
 * PlanningSheet に取り込む。
 */
import type { ProcedureStep } from '@/domain/isp/schema';
import type { SupportTemplateCsvRow } from '@/features/import/domain/csvImportTypes';
import {
  csvRowsToProcedureSteps,
  masterRowsToProcedureSteps,
} from '@/features/planning-sheet/bridge/supportTemplateBridge';
import { hasUserProcedureMaster } from '@/features/planning-sheet/constants/userProcedureDetails';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
import Papa from 'papaparse';
import React, { useCallback, useMemo, useRef, useState } from 'react';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const AGENT_PROMPT_TEMPLATE = `支援手順追加ガイドに従って、〇〇さんの USER_PROCEDURE_DETAILS / USER_PROCEDURE_SHEET_NOTES を追加してください。

前提:
- 公式ガイド: docs/guides/support-procedure-addition-guide.md
- 1利用者 = 1PR
- 原紙文言は要約しない
- セル内改行は \\n で保持する
- 本人の動きと支援者の動きを混ぜない
- 一日全体の注意事項を row データに混ぜない
- dailyProcedureMapper.ts などの L2→L3 変換ロジック本体は原則変更しない

作業手順:
1. 対象者のExcel原紙を確認する
2. 本番UserID・fixture userId・DEMO IDを確認する
3. 17行の「本人の動き」「支援者の動き」を抽出する
4. 下部欄「一日を通して気を付ける事」「その他」を抽出する
5. src/features/planning-sheet/constants/userProcedureDetails.ts の USER_PROCEDURE_DETAILS に17行を追加する
6. USER_PROCEDURE_SHEET_NOTES に下部欄を追加する
7. isUserMatch / 個別ID判定に必要な alias を追加する
8. src/features/planning-sheet/logic/__tests__/dailyProcedureMapper.spec.ts に代表行・下部欄・ID解決テストを追加する
9. 以下を実行して検証する
   - npx vitest run src/features/planning-sheet/logic/__tests__/dailyProcedureMapper.spec.ts
   - npx vitest run src/features/planning-sheet
   - npm run typecheck
10. データ追加だけの小PRを作成する

PR本文には以下を必ず記載してください:
- データソース
- 対象者ID / ID alias
- 追加した17行手順の概要
- 下部欄メモの有無
- 検証コマンドと結果`;

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** 取り込まれた ProcedureStep[] を受け取るコールバック */
  onImport: (steps: ProcedureStep[]) => void;
  /** 既存の ProcedureSteps の件数（上書き確認用） */
  existingStepCount: number;
  /** 対象利用者のID（標準テンプレートの自動紐づけ用） */
  userId?: string;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const ImportTemplateDialog: React.FC<Props> = ({
  open,
  onClose,
  onImport,
  existingStepCount,
  userId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tabValue, setTabValue] = useState<number>(0);
  const [parsedRows, setParsedRows] = useState<SupportTemplateCsvRow[]>([]);
  const [userCodes, setUserCodes] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // 🤖 エージェントプロンプトコピーステート
  const [showPromptPreview, setShowPromptPreview] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(AGENT_PROMPT_TEMPLATE)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000); // 3秒後に「コピー完了」を戻す
      })
      .catch((err) => {
        console.error('Failed to copy prompt template:', err);
      });
  }, []);

  // ── 1. 静的マスタ手順のロード ──
  const masterSteps = useMemo(() => {
    if (!userId || !hasUserProcedureMaster(userId)) return [];
    return masterRowsToProcedureSteps(userId);
  }, [userId]);

  // ── 2. CSV パース ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse<SupportTemplateCsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });

      if (parsed.data.length === 0) {
        setError('CSV にデータ行がありません');
        return;
      }

      setParsedRows(parsed.data);

      // ユーザーコード一覧を抽出
      const codes = [...new Set(parsed.data.map((r) => r.UserCode?.trim()).filter(Boolean))];
      setUserCodes(codes);
      setSelectedUser(codes[0] ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV の読み込みに失敗しました');
    }
  }, []);

  const filteredRows = useMemo(
    () => parsedRows.filter((r) => r.UserCode?.trim() === selectedUser),
    [parsedRows, selectedUser],
  );

  const csvPreviewSteps = useMemo(
    () => csvRowsToProcedureSteps(filteredRows),
    [filteredRows],
  );

  // ── 3. アクティブな手順の選択（タブ準拠） ──
  const activeSteps = useMemo(() => {
    return tabValue === 0 ? masterSteps : csvPreviewSteps;
  }, [tabValue, masterSteps, csvPreviewSteps]);

  // ── 4. インポート確定 ──
  const handleImport = useCallback(() => {
    onImport(activeSteps);
    handleReset();
    onClose();
  }, [activeSteps, onImport, onClose]);

  // ── 5. リセット & クローズ ──
  const handleReset = useCallback(() => {
    setParsedRows([]);
    setUserCodes([]);
    setSelectedUser('');
    setError(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    setTabValue(0);
    onClose();
  }, [handleReset, onClose]);

  // ── 6. サンプル CSV の BOM付きダウンロード ──
  const handleDownloadSample = useCallback(() => {
    const csvContent = [
      'RowNo,活動内容,本人の動き,支援者の動き,時間帯',
      '1,通所・朝の準備,手洗い、消毒、荷物をロッカーへ入れる,通所時の様子を確認し、必要に応じて声かけ・見守りを行う,9:30頃',
      '2,体操,体操に参加する,本人の様子を見ながら参加を促す,10:00頃',
      '3,スケジュール確認,一日の予定を確認する,本人と一緒に予定を確認し、見通しが持てるよう支援する,10:10頃',
      '4,お茶休憩,手洗い後、お茶を飲む,お茶の準備、片付け、必要に応じた声かけを行う,10:15頃',
    ].join('\r\n');

    // UTF-8 BOM (\uFEFF -> 0xEF, 0xBB, 0xBF)
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'support_procedure_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: 400, borderRadius: 2 } }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.2} alignItems="center">
            <CloudUploadRoundedIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>テンプレートから取り込み</Typography>
          </Stack>
          <Tooltip title="docs/guides/support-procedure-addition-guide.md を参照 (ローカル環境用)">
            <Button
              size="small"
              variant="text"
              color="primary"
              href="file:///Users/yasutakesougo/audit-management-system-mvp/docs/guides/support-procedure-addition-guide.md"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              ❓ 取り込みガイドを確認
            </Button>
          </Tooltip>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {/* 💡 インセプションガイド（役割分担） */}
          <Alert
            severity="info"
            variant="outlined"
            sx={{
              borderColor: 'info.light',
              bgcolor: 'rgba(2, 136, 209, 0.04)',
              '& .MuiAlert-icon': { color: 'info.main' },
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} color="info.dark" sx={{ mb: 0.5 }}>
              取り込み機能の使い分けについて
            </Typography>
            <Typography variant="body2" color="text.primary" component="div">
              • <b>恒久的な標準手順の登録（管理者向け）:</b><br />
              Excel原紙からの恒久マスタへの追加は「原紙 ➔ 定数追加 ➔ テスト ➔ PRマージ」のPR連携ワークフローで行います。
              <Box sx={{ mt: 1, pl: 1.5, borderLeft: '2px solid', borderColor: 'info.light' }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  初めて作業する場合は、以下のプロンプトをコピーして開発エージェントに渡してください。
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    variant="contained"
                    color="info"
                    onClick={handleCopyPrompt}
                    startIcon={copied ? <CheckCircleOutlineIcon /> : <ContentCopyIcon />}
                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.25 }}
                  >
                    {copied ? 'プロンプトをコピーしました！' : '🤖 エージェント指示プロンプトをコピー'}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    color="info"
                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}
                  >
                    {showPromptPreview ? 'プレビューを非表示' : 'プロンプトを表示'}
                  </Button>
                </Stack>
                
                <Collapse in={showPromptPreview} sx={{ mt: 1 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.paper',
                      maxHeight: 200,
                      overflowY: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      color: 'text.secondary',
                    }}
                  >
                    {AGENT_PROMPT_TEMPLATE}
                  </Paper>
                </Collapse>
              </Box>
            </Typography>
            <Typography variant="body2" color="text.primary" component="div" sx={{ mt: 1.5 }}>
              • <b>画面上のCSV取り込み・適用（一時検証）:</b><br />
              編集中の支援計画シートへ一時的に手順を差し込んで確認するための機能（一時検証・下書き用）です。
            </Typography>
          </Alert>

          {/* ── タブ切り替え ── */}
          <Tabs
            value={tabValue}
            onChange={(_e, v) => setTabValue(v)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="標準テンプレートから選択 (推奨)" sx={{ fontWeight: 600 }} />
            <Tab label="CSVファイルからインポート" sx={{ fontWeight: 600 }} />
          </Tabs>

          {/* ── タブ1: 標準テンプレートから選択 ── */}
          {tabValue === 0 && (
            <Stack spacing={2}>
              {userId && hasUserProcedureMaster(userId) ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(46, 125, 50, 0.04)',
                    borderColor: 'success.light',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} color="success.dark" gutterBottom>
                    利用者の標準テンプレートが見つかりました
                  </Typography>
                  <Typography variant="body2" color="text.primary">
                    対象利用者 (ID: <b>{userId}</b>) の静的マスタに登録されている標準支援手順 (17行構成) が利用可能です。<br />
                    下部のプレビューを確認し、問題なければ [取り込む] ボタンを押してください。
                  </Typography>
                </Paper>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(211, 47, 47, 0.04)',
                    borderColor: 'error.light',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} color="error.dark" gutterBottom>
                    標準テンプレート未登録
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ mb: 1.5 }}>
                    対象利用者 (ID: <b>{userId || '未設定'}</b>) の標準支援手順はマスタに登録されていません。
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    新規に利用者の標準マスタを登録したい場合は、公式ガイド <code>docs/guides/support-procedure-addition-guide.md</code> を確認の上、静的マスタ定数ファイルを更新し、PRをマージして反映させてください。
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}

          {/* ── タブ2: CSVファイルからインポート ── */}
          {tabValue === 1 && (
            <Stack spacing={2.5}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  1. SupportTemplate CSV を選択
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUploadRoundedIcon />}
                  >
                    CSV を選択
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      hidden
                      onChange={handleFileSelect}
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleDownloadSample}
                  >
                    サンプル CSV をダウンロード
                  </Button>
                  {fileName && (
                    <Chip size="small" label={fileName} variant="outlined" onDelete={handleReset} />
                  )}
                </Stack>
              </Paper>

              {error && <Alert severity="error">{error}</Alert>}

              {userCodes.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    2. 利用者を選択
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      select
                      label="利用者コード"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      size="small"
                      sx={{ minWidth: 200 }}
                    >
                      {userCodes.map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}（{parsedRows.filter((r) => r.UserCode?.trim() === code).length} 手順）
                        </MenuItem>
                      ))}
                    </TextField>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${userCodes.length} 名分のデータ`}
                    />
                  </Stack>
                </Paper>
              )}

              {/* 💡 仕様ヘルプテーブル */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  💡 CSV 列の構成仕様 (ヘッダー名)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  CSVファイルを自作または編集する際は、必ず以下の構成名に揃えてください。
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>列名 (ヘッダー)</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>必須 / 任意</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>説明</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell><code>RowNo</code></TableCell>
                        <TableCell><Chip label="任意" size="small" /></TableCell>
                        <TableCell>手順の並び順 (1, 2, 3...)。指定がない場合は上から順に採番</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code>活動内容</code></TableCell>
                        <TableCell><Chip label="必須" color="primary" size="small" /></TableCell>
                        <TableCell>手順内容の基本となる活動項目</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code>本人の動き</code></TableCell>
                        <TableCell><Chip label="任意" size="small" /></TableCell>
                        <TableCell>本人の詳細な行動。活動内容と自動的に結合されます</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code>支援者の動き</code></TableCell>
                        <TableCell><Chip label="任意" size="small" /></TableCell>
                        <TableCell>スタッフ側の具体的な介入・支援内容 (担当・介入方法)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code>時間帯</code></TableCell>
                        <TableCell><Chip label="任意" size="small" /></TableCell>
                        <TableCell>実施の目安タイミング (例: 9:30頃)</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Stack>
          )}

          {/* ── 共通プレビュー ── */}
          {activeSteps.length > 0 && (
            <>
              <Divider />
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {tabValue === 0 ? '標準テンプレートプレビュー' : 'CSV取り込みプレビュー'}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${activeSteps.length} ステップ`}
                    color="primary"
                    variant="outlined"
                  />
                </Stack>

                {existingStepCount > 0 && (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    現在 {existingStepCount} 件の手順があります。取り込みにより上書きされます。
                  </Alert>
                )}

                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 40 }}>#</TableCell>
                        <TableCell>タイミング</TableCell>
                        <TableCell>手順内容</TableCell>
                        <TableCell>支援者</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeSteps.map((step) => (
                        <TableRow key={step.order}>
                          <TableCell>
                            <Typography variant="caption" fontWeight={600}>{step.order}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="primary.main">{step.timing || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{step.instruction}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {step.staff || '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>キャンセル</Button>
        <Button
          variant="contained"
          disabled={activeSteps.length === 0}
          onClick={handleImport}
          startIcon={<CheckCircleOutlineIcon />}
        >
          {activeSteps.length} ステップを取り込む
        </Button>
      </DialogActions>
    </Dialog>
  );
};
