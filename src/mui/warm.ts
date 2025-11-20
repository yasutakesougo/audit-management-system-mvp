/**
 * MUI テーブル系コンポーネントの事前読み込み（ウォームアップ）
 * 画面表示前にコンポーネントを読み込んでおくことで、初回レンダリングを高速化
 */

/**
 * テーブル系コンポーネントのプリロード
 * 失敗しても致命的ではないため、エラーは握りつぶして警告ログのみ出力
 */
export async function warmTableComponents(): Promise<void> {
  try {
    await Promise.all([
      import('@mui/material/Table'),
      import('@mui/material/TableBody'),
      import('@mui/material/TableCell'),
      import('@mui/material/TableContainer'),
      import('@mui/material/TableHead'),
      import('@mui/material/TableRow'),
      import('@mui/material/Paper'),
    ]);
  } catch {
    // ネットワークエラーやバンドル失敗等があっても UI は正常動作させる
    if (typeof window !== 'undefined' && typeof console !== 'undefined') {
      console.warn('[mui warm] table components preload failed (non-fatal)');
    }
  }
}

/**
 * データ入力系コンポーネントのプリロード
 * Card、Button、Dialog等の重要なコンポーネントを事前読み込み
 */
export async function warmDataEntryComponents(): Promise<void> {
  try {
    await Promise.all([
      import('@mui/material/Card'),
      import('@mui/material/CardContent'),
      import('@mui/material/Dialog'),
      import('@mui/material/DialogTitle'),
      import('@mui/material/DialogContent'),
      import('@mui/material/DialogActions'),
      import('@mui/material/TextField'),
      import('@mui/material/Select'),
      import('@mui/material/MenuItem'),
      import('@mui/material/Switch'),
      import('@mui/material/Chip'),
      import('@mui/material/Alert'),
      import('@mui/material/Snackbar'),
    ]);
  } catch {
    if (typeof window !== 'undefined' && typeof console !== 'undefined') {
      console.warn('[mui warm] data entry components preload failed (non-fatal)');
    }
  }
}

/**
 * 包括的なMUIコンポーネントウォームアップ
 * データ管理画面で使用される主要コンポーネントを一括プリロード
 */
export async function warmAll(): Promise<void> {
  // 並列実行で効率的にプリロード
  await Promise.all([
    warmTableComponents(),
    warmDataEntryComponents(),
  ]);
}

/**
 * Fire-and-forget スタイルでのウォームアップ
 * エラーを完全に握りつぶし、呼び出し側でのcatch不要
 */
export function warmAsync(): void {
  warmAll().catch(() => {
    // 意図的に何もしない - プリロード失敗は非致命的
  });
}