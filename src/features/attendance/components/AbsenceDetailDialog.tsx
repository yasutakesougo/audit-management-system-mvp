/**
 * AbsenceDetailDialog — 欠席情報入力ダイアログ
 *
 * 「欠席」ボタン押下時に表示し、欠席対応ログを収集する。
 *
 * 2セクション構造（Paper でグルーピング）:
 *   ① 朝連絡（受け入れ）— 受電時刻・連絡者・理由・相談援助
 *   ② 夕方連絡（様子伺い）— 連絡時刻・連絡先・確認内容・結果
 *   + 次回利用予定日
 *
 * 3つのアクション:
 *   - 保存: AbsentSupportLog 付きで欠席ステータスを更新
 *   - 後で入力: ステータスのみ更新（ログなし）
 *   - キャンセル: 何もしない
 */
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import {
    EMPTY_ABSENT_LOG,
    type AbsentSupportLog,
    type FollowUpResult,
} from '@/features/service-provision/domain/absentSupportLog';

// ─── 選択肢定義 ──────────────────────────────────────────

export const CONTACTOR_OPTIONS = ['本人', '家族', 'その他'] as const;
export const REASON_PRESETS = ['体調不良', '私用', '通院'] as const;
export const FOLLOW_UP_RESULTS: FollowUpResult[] = ['実施', '不通', '不要'];

// ─── JST ローカル日時文字列 (datetime-local 用) ───────────

/** 現在のローカル日時を "YYYY-MM-DDThh:mm" 形式で返す */
export function nowLocalDatetime(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

// ─── Props ───────────────────────────────────────────────

export type AbsenceDetailDialogProps = {
  open: boolean;
  userName: string;
  /** 既存データ（編集時に渡す） */
  initialData?: AbsentSupportLog;
  onSubmit: (log: AbsentSupportLog) => void;
  onSkip: () => void;
  onCancel: () => void;
};

// ─── Internal form state ─────────────────────────────────

type FormState = AbsentSupportLog & {
  /** ドロップダウンの選択値（'体調不良'|'私用'|'通院'|'other'|''） */
  reasonSelect: string;
  /** 「その他」の場合のフリーテキスト */
  reasonFreeText: string;
};

function isPresetReason(v: string): boolean {
  return (REASON_PRESETS as readonly string[]).includes(v);
}

function initFormState(data?: AbsentSupportLog): FormState {
  const base = data ?? { ...EMPTY_ABSENT_LOG, contactDateTime: nowLocalDatetime() };
  const reasonIsPreset = isPresetReason(base.absenceReason);
  return {
    ...base,
    reasonSelect: reasonIsPreset
      ? base.absenceReason
      : base.absenceReason
        ? 'other'
        : '',
    reasonFreeText: reasonIsPreset ? '' : base.absenceReason,
  };
}

function formToLog(form: FormState): AbsentSupportLog {
  const absenceReason =
    form.reasonSelect === 'other'
      ? form.reasonFreeText
      : form.reasonSelect;

  return {
    contactDateTime: form.contactDateTime,
    contactPerson: form.contactPerson,
    absenceReason,
    supportContent: form.supportContent,
    followUpDateTime: form.followUpDateTime,
    followUpTarget: form.followUpTarget,
    followUpContent: form.followUpContent,
    followUpResult: form.followUpResult,
    nextPlannedDate: form.nextPlannedDate,
    staffInChargeId: form.staffInChargeId,
  };
}

// ─── Section header helper ───────────────────────────────

function SectionHeader({
  label,
  number,
  color = 'primary',
}: {
  label: string;
  number: string;
  color?: 'primary' | 'secondary';
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: `${color}.main`,
          color: `${color}.contrastText`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {number}
      </Box>
      <Typography fontWeight={700} fontSize={15}>
        {label}
      </Typography>
    </Box>
  );
}

// ─── Component ───────────────────────────────────────────

export function AbsenceDetailDialog({
  open,
  userName,
  initialData,
  onSubmit,
  onSkip,
  onCancel,
}: AbsenceDetailDialogProps): JSX.Element {
  const [form, setForm] = useState<FormState>(() => initFormState());

  // ダイアログが開かれるたびにフォームをリセット
  useEffect(() => {
    if (open) {
      setForm(initFormState(initialData));
    }
  }, [open, initialData]);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    onSubmit(formToLog(form));
  }, [form, onSubmit]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      data-testid="absence-detail-dialog"
    >
      <DialogTitle>
        <Typography component="span" fontWeight={700}>
          欠席情報の登録
        </Typography>
        <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
          {userName}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>

          {/* ── ① 朝連絡（受け入れ） ────────────────── */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <SectionHeader number="①" label="朝連絡（受け入れ）" />
            <Stack spacing={2} sx={{ mt: 2 }}>
              {/* 連絡日時 */}
              <TextField
                label="連絡日時"
                type="datetime-local"
                value={form.contactDateTime}
                onChange={(e) => setField('contactDateTime', e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                data-testid="absence-contact-datetime"
              />

              {/* 連絡者区分 */}
              <FormControl fullWidth>
                <InputLabel id="absence-contactor-label">連絡者</InputLabel>
                <Select
                  labelId="absence-contactor-label"
                  label="連絡者"
                  value={form.contactPerson}
                  onChange={(e) => setField('contactPerson', e.target.value)}
                  data-testid="absence-contactor"
                >
                  <MenuItem value=""><em>未選択</em></MenuItem>
                  {CONTACTOR_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 欠席理由（プリセット + その他） */}
              <FormControl fullWidth>
                <InputLabel id="absence-reason-label">欠席理由</InputLabel>
                <Select
                  labelId="absence-reason-label"
                  label="欠席理由"
                  value={form.reasonSelect}
                  onChange={(e) => setField('reasonSelect', e.target.value)}
                  data-testid="absence-reason"
                >
                  <MenuItem value=""><em>未選択</em></MenuItem>
                  {REASON_PRESETS.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                  <MenuItem value="other">その他</MenuItem>
                </Select>
              </FormControl>

              {/* 「その他」選択時のフリーテキスト */}
              {form.reasonSelect === 'other' && (
                <TextField
                  label="理由の詳細"
                  value={form.reasonFreeText}
                  onChange={(e) => setField('reasonFreeText', e.target.value)}
                  fullWidth
                  placeholder="具体的な理由を入力"
                  data-testid="absence-reason-freetext"
                />
              )}

              {/* 対応内容 */}
              <TextField
                label="対応内容（相談援助）"
                value={form.supportContent}
                onChange={(e) => setField('supportContent', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                placeholder="電話口で伝えた内容や特記事項"
                data-testid="absence-support-content"
              />
            </Stack>
          </Paper>

          {/* ── ② 夕方連絡（様子伺い） ───────────────── */}
          <Paper
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}
          >
            <Box sx={{ mb: 2 }}>
              <SectionHeader number="②" label="夕方連絡（様子伺い）" color="secondary" />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center', mt: 0.5, ml: 4.5 }}
                data-testid="absence-evening-info"
              >
                <InfoOutlinedIcon fontSize="inherit" sx={{ mr: 0.5 }} />
                このセクションを入力すると、夕方の様子確認が自動的に「済」になります。
              </Typography>
            </Box>
            <Stack spacing={2}>
              {/* 様子伺い連絡日時 */}
              <TextField
                label="連絡日時"
                type="datetime-local"
                value={form.followUpDateTime}
                onChange={(e) => setField('followUpDateTime', e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                data-testid="absence-followup-datetime"
              />

              {/* 連絡先 */}
              <TextField
                label="連絡先"
                value={form.followUpTarget}
                onChange={(e) => setField('followUpTarget', e.target.value)}
                fullWidth
                placeholder="例: ご自宅、ご家族携帯"
                data-testid="absence-followup-target"
              />

              {/* 確認内容 */}
              <TextField
                label="確認内容"
                value={form.followUpContent}
                onChange={(e) => setField('followUpContent', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                placeholder="体調の様子や明日の利用意向など"
                data-testid="absence-followup-content"
              />

              {/* 結果 */}
              <FormControl fullWidth>
                <InputLabel id="absence-followup-result-label">結果</InputLabel>
                <Select
                  labelId="absence-followup-result-label"
                  label="結果"
                  value={form.followUpResult}
                  onChange={(e) => setField('followUpResult', e.target.value as FollowUpResult)}
                  data-testid="absence-followup-result"
                >
                  {FOLLOW_UP_RESULTS.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {/* ── 次回利用予定日 ────────────────────────── */}
          <TextField
            label="次回利用予定日"
            type="date"
            value={form.nextPlannedDate}
            onChange={(e) => setField('nextPlannedDate', e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            data-testid="absence-next-date"
          />

        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} color="inherit">
          キャンセル
        </Button>
        <Button onClick={onSkip} color="inherit" variant="outlined">
          後で入力
        </Button>
        <Button onClick={handleSubmit} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
