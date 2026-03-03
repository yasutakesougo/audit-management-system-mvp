/**
 * TemperatureKeypad — 2ステップ体温入力パッド
 *
 * 従来の type="number" TextField を置き換え、
 * OSキーボードを一切開かずに2タップで体温を入力できる専用コンポーネント。
 *
 * ステップ1: 整数部（35〜42）を選択
 * ステップ2: 小数部（.0〜.9）をタップ → 自動確定
 *
 * デフォルトで「36」が選択状態。
 */
import ThermostatIcon from '@mui/icons-material/Thermostat';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

// ─── 定数 ─────────────────────────────────────────────────

/** 整数部の選択肢 */
export const INTEGER_OPTIONS = [35, 36, 37, 38, 39, 40, 41, 42] as const;

/** 小数部の選択肢 */
export const DECIMAL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** デフォルト整数部（朝の受け入れ時 36℃台が最頻値） */
export const DEFAULT_INTEGER = 36;

// ─── Props ────────────────────────────────────────────────

export type TemperatureKeypadProps = {
  open: boolean;
  userName: string;
  /** 既存の体温値（再入力時に初期表示する） */
  initialValue?: number;
  /** 確定時のコールバック。35.0〜42.9 のバリデーション済み値を返す */
  onConfirm: (temperature: number) => void;
  onCancel: () => void;
};

// ─── Component ────────────────────────────────────────────

export function TemperatureKeypad({
  open,
  userName,
  initialValue,
  onConfirm,
  onCancel,
}: TemperatureKeypadProps): JSX.Element {
  const [selectedInteger, setSelectedInteger] = useState<number>(DEFAULT_INTEGER);

  // ダイアログが開かれるたびに初期値をリセット
  useEffect(() => {
    if (open) {
      if (initialValue != null && initialValue >= 35 && initialValue <= 42) {
        setSelectedInteger(Math.floor(initialValue));
      } else {
        setSelectedInteger(DEFAULT_INTEGER);
      }
    }
  }, [open, initialValue]);

  const handleDecimalClick = useCallback(
    (decimal: number) => {
      const temperature = selectedInteger + decimal / 10;
      // 丸め誤差防止
      const rounded = Math.round(temperature * 10) / 10;
      onConfirm(rounded);
    },
    [selectedInteger, onConfirm],
  );

  const displayValue = `${selectedInteger}._`;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      data-testid="temperature-keypad-dialog"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ThermostatIcon color="primary" />
        検温（{userName}）
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 1 }}>
          {/* ── プレビュー表示 ───────────────── */}
          <Typography
            variant="h3"
            fontWeight={700}
            data-testid="temperature-preview"
            sx={{ mb: 2, fontVariantNumeric: 'tabular-nums' }}
          >
            {displayValue}
            <Typography component="span" variant="h5" color="text.secondary" sx={{ ml: 0.5 }}>
              ℃
            </Typography>
          </Typography>

          {/* ── ステップ1: 整数部 ────────────── */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1, textAlign: 'left' }}
          >
            整数部を選択
          </Typography>
          <Grid container spacing={1} sx={{ mb: 2.5 }}>
            {INTEGER_OPTIONS.map((n) => (
              <Grid key={n} size={{ xs: 3 }}>
                <Button
                  fullWidth
                  variant={selectedInteger === n ? 'contained' : 'outlined'}
                  color={n >= 38 ? 'warning' : 'primary'}
                  onClick={() => setSelectedInteger(n)}
                  data-testid={`integer-btn-${n}`}
                  sx={{
                    minHeight: 48,
                    fontSize: 18,
                    fontWeight: selectedInteger === n ? 700 : 400,
                  }}
                >
                  {n}
                </Button>
              </Grid>
            ))}
          </Grid>

          {/* ── ステップ2: 小数部 ────────────── */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1, textAlign: 'left' }}
          >
            小数部をタップして確定
          </Typography>
          <Grid container spacing={1}>
            {DECIMAL_OPTIONS.map((d) => (
              <Grid key={d} size={{ xs: 2.4 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => handleDecimalClick(d)}
                  data-testid={`decimal-btn-${d}`}
                  sx={{
                    minHeight: 52,
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  .{d}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">
          キャンセル
        </Button>
      </DialogActions>
    </Dialog>
  );
}
