import { useStaff } from "@/stores/useStaff";
import type { Staff, StaffUpsert } from "@/types";
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import WorkIcon from '@mui/icons-material/Work';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    IconButton,
    Paper,
    Snackbar,
    TextField,
    Typography,
} from "@mui/material";
import { createRef, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type StaffFormProps = {
  staff?: Staff;
  mode?: "create" | "update";
  onSuccess?: (staff: Staff) => void;
  onDone?: (staff: Staff) => void;
  onClose?: () => void;
};

type MessageState = { type: "success" | "error"; text: string } | null;

type FormValues = {
  StaffID: string;
  FullName: string;
  Email: string;
  Phone: string;
  Role: string;
  WorkDays: string[];
  Certifications: string[];
  IsActive: boolean;
  BaseShiftStartTime: string;
  BaseShiftEndTime: string;
  BaseWorkingDays: string[];
};

type Errors = Partial<Record<"fullName" | "email" | "phone" | "baseShift", string>>;

const DAYS: { value: string; label: string }[] = [
  { value: "Mon", label: "月" },
  { value: "Tue", label: "火" },
  { value: "Wed", label: "水" },
  { value: "Thu", label: "木" },
  { value: "Fri", label: "金" },
  { value: "Sat", label: "土" },
  { value: "Sun", label: "日" },
];

const BASE_WEEKDAY_OPTIONS: { value: string; label: string }[] = [
  { value: "月", label: "月" },
  { value: "火", label: "火" },
  { value: "水", label: "水" },
  { value: "木", label: "木" },
  { value: "金", label: "金" },
];

const BASE_WEEKDAY_DEFAULTS = BASE_WEEKDAY_OPTIONS.map((option) => option.value);

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const timeRe = /^\d{2}:\d{2}$/;

const sanitize = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toUpsert = (values: FormValues): StaffUpsert => ({
  StaffID: sanitize(values.StaffID),
  FullName: sanitize(values.FullName),
  Email: sanitize(values.Email),
  Phone: sanitize(values.Phone),
  Role: sanitize(values.Role),
  WorkDays: values.WorkDays.length ? values.WorkDays : undefined,
  Certifications: values.Certifications.length ? values.Certifications : undefined,
  IsActive: values.IsActive,
  BaseShiftStartTime: values.BaseShiftStartTime.trim() ? values.BaseShiftStartTime.trim() : null,
  BaseShiftEndTime: values.BaseShiftEndTime.trim() ? values.BaseShiftEndTime.trim() : null,
  BaseWorkingDays: values.BaseWorkingDays,
});


const CERTIFICATION_OPTIONS: { value: string; label: string }[] = [
  { value: "普通運転免許", label: "普通運転免許" },
  { value: "介護福祉士", label: "介護福祉士" },
  { value: "看護師", label: "看護師" },
  { value: "保育士", label: "保育士" },
  { value: "社会福祉士", label: "社会福祉士" },
];

export function StaffForm({ staff, mode = staff ? "update" : "create", onSuccess, onDone, onClose }: StaffFormProps) {
  const { createStaff, updateStaff } = useStaff();

  const deriveInitialValues = useCallback(
    (): FormValues => ({
      StaffID: staff?.staffId ?? "",
      FullName: staff?.name ?? "",
      Email: staff?.email ?? "",
      Phone: staff?.phone ?? "",
      Role: staff?.role ?? "",
      WorkDays: [...(staff?.workDays ?? [])],
      Certifications: [...(staff?.certifications ?? [])],
      IsActive: staff?.active ?? true,
      BaseShiftStartTime: staff?.baseShiftStartTime ?? "08:30",
      BaseShiftEndTime: staff?.baseShiftEndTime ?? "17:30",
      BaseWorkingDays: staff ? [...staff.baseWorkingDays] : [...BASE_WEEKDAY_DEFAULTS],
    }),
    [staff]
  );

  const [values, setValues] = useState<FormValues>(() => deriveInitialValues());
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const initialJson = useRef(JSON.stringify(values));
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const next = deriveInitialValues();
    setValues(next);
    setErrors({});
    setMessage(null);
    initialJson.current = JSON.stringify(next);
  }, [deriveInitialValues]);

  const serializedValues = useMemo(() => JSON.stringify(values), [values]);
  const isDirty = serializedValues !== initialJson.current;

  const errRefs = useMemo(
    () => ({
      fullName: createRef<HTMLInputElement>(),
      email: createRef<HTMLInputElement>(),
      phone: createRef<HTMLInputElement>(),
      baseShift: createRef<HTMLInputElement>(),
    }),
    []
  );

  const focusFirstInvalid = useCallback(
    (nextErrors: Errors) => {
      const order: Array<keyof Errors> = ["fullName", "email", "phone", "baseShift"];
      for (const key of order) {
        if (nextErrors[key]) {
          const ref = errRefs[key];
          ref?.current?.focus();
          break;
        }
      }
    },
    [errRefs]
  );

  const validate = useCallback(
    (next: FormValues): Errors => {
      const errs: Errors = {};
      if (!next.FullName.trim() && !next.StaffID.trim()) {
        errs.fullName = "氏名（またはスタッフID）のいずれかは必須です";
      }
      if (next.Email && !emailRe.test(next.Email.trim())) {
        errs.email = "メール形式が不正です";
      }
      if (next.Phone) {
        const digits = next.Phone.replace(/\D/g, "");
        if (digits.length < 10) {
          errs.phone = "電話番号を正しく入力してください";
        }
      }
      const start = next.BaseShiftStartTime.trim();
      const end = next.BaseShiftEndTime.trim();
      const hasStart = start.length > 0;
      const hasEnd = end.length > 0;
      if ((hasStart && !timeRe.test(start)) || (hasEnd && !timeRe.test(end))) {
        errs.baseShift = "時刻はHH:MM形式で入力してください";
      } else if (hasStart && hasEnd && end <= start) {
        errs.baseShift = "基本勤務の終了時刻は開始時刻より後にしてください";
      }
      return errs;
    },
    []
  );

  const handleClose = useCallback(() => {
    if (isSaving) return;
    if (isDirty && !window.confirm("未保存の変更があります。閉じてもよろしいですか？")) {
      return;
    }
    onClose?.();
  }, [isDirty, isSaving, onClose]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isSaving && isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, isSaving]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isSaving) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, isSaving]);

  const setField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleWorkDay = useCallback((day: string) => {
    setValues((prev) => {
      const set = new Set(prev.WorkDays);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      const ordered = DAYS.map((d) => d.value).filter((d) => set.has(d));
      return { ...prev, WorkDays: ordered };
    });
  }, []);

  const toggleBaseWorkingDay = useCallback((day: string) => {
    setValues((prev) => {
      const set = new Set(prev.BaseWorkingDays);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      const ordered = BASE_WEEKDAY_OPTIONS.map((option) => option.value).filter((value) => set.has(value));
      return { ...prev, BaseWorkingDays: ordered };
    });
  }, []);

  const toggleCertification = useCallback((cert: string) => {
    setValues((prev) => {
      const set = new Set(prev.Certifications);
      if (set.has(cert)) {
        set.delete(cert);
      } else {
        set.add(cert);
      }
      return { ...prev, Certifications: Array.from(set) };
    });
  }, []);

  const removeCertification = useCallback((cert: string) => {
    setValues((prev) => ({
      ...prev,
      Certifications: prev.Certifications.filter((value) => value !== cert),
    }));
  }, []);

  const [customCertification, setCustomCertification] = useState("");

  const handleAddCustomCertification = useCallback(() => {
    const trimmed = customCertification.trim();
    if (!trimmed) return;
    setValues((prev) => {
      if (prev.Certifications.includes(trimmed)) {
        return prev;
      }
      return { ...prev, Certifications: [...prev.Certifications, trimmed] };
    });
    setCustomCertification("");
  }, [customCertification]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextErrors = validate(values);
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        focusFirstInvalid(nextErrors);
        return;
      }

      setIsSaving(true);
      setMessage(null);
      setErrors({});

      const payload = toUpsert(values);

      try {
        let result: Staff | null = null;
        if (mode === "create") {
          result = await createStaff(payload);
          const cleared: FormValues = {
            StaffID: "",
            FullName: "",
            Email: "",
            Phone: "",
            Role: "",
            WorkDays: [],
            Certifications: [],
            IsActive: true,
            BaseShiftStartTime: "08:30",
            BaseShiftEndTime: "17:30",
            BaseWorkingDays: [...BASE_WEEKDAY_DEFAULTS],
          };
          setValues(cleared);
          initialJson.current = JSON.stringify(cleared);
        } else if (mode === "update" && staff) {
          result = await updateStaff(staff.id, payload);
          initialJson.current = JSON.stringify(values);
        } else {
          throw new Error("更新対象のスタッフIDが指定されていません。");
        }

        if (result) {
          setMessage({ type: "success", text: mode === "create" ? "作成しました" : "更新しました" });
          onSuccess?.(result);
          onDone?.(result);
        }
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "保存に失敗しました" });
      } finally {
        setIsSaving(false);
      }
    },
    [createStaff, focusFirstInvalid, mode, onDone, onSuccess, staff, updateStaff, validate, values]
  );

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6" component="h2">
            {mode === 'create' ? '新規職員登録' : '職員情報編集'}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <form
        ref={formRef}
        data-form="staff"
        onSubmit={handleSubmit}
      >
        {/* Status Messages */}
        {message && (
          <Alert
            severity={message.type === "success" ? "success" : "error"}
            sx={{ mb: 2 }}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        {/* 基本情報 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
            <PersonIcon sx={{ mr: 1 }} />
            基本情報
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="スタッフID"
              value={values.StaffID}
              onChange={(event) => setField("StaffID", event.target.value)}
              placeholder="例: ST-001"
              autoComplete="off"
              variant="outlined"
              size="small"
            />

            <TextField
              fullWidth
              required
              label="氏名"
              inputRef={errRefs.fullName}
              value={values.FullName}
              onChange={(event) => setField("FullName", event.target.value)}
              error={Boolean(errors.fullName)}
              helperText={errors.fullName}
              placeholder="山田 太郎"
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>
        {/* 連絡先情報 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
            連絡先情報
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              type="email"
              label="メール"
              inputRef={errRefs.email}
              value={values.Email}
              onChange={(event) => setField("Email", event.target.value)}
              error={Boolean(errors.email)}
              helperText={errors.email}
              placeholder="taro.yamada@example.com"
              autoComplete="email"
              variant="outlined"
              size="small"
            />

            <TextField
              fullWidth
              label="電話番号"
              inputRef={errRefs.phone}
              value={values.Phone}
              onChange={(event) => setField("Phone", event.target.value)}
              error={Boolean(errors.phone)}
              helperText={errors.phone}
              placeholder="09012345678"
              autoComplete="tel"
              variant="outlined"
              size="small"
            />

            <TextField
              fullWidth
              label="役職"
              value={values.Role}
              onChange={(event) => setField("Role", event.target.value)}
              placeholder="サービス管理責任者"
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>

        {/* 基本勤務パターン */}
        <Box sx={{ mb: 3, border: '1px solid', borderColor: 'grey.300', borderRadius: 1, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
            <WorkIcon sx={{ mr: 1 }} />
            基本勤務パターン
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="開始時刻"
              type="time"
              inputRef={errRefs.baseShift}
              value={values.BaseShiftStartTime}
              onChange={(event) => setField("BaseShiftStartTime", event.target.value)}
              error={Boolean(errors.baseShift)}
              helperText={errors.baseShift}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="終了時刻"
              type="time"
              value={values.BaseShiftEndTime}
              onChange={(event) => setField("BaseShiftEndTime", event.target.value)}
              error={Boolean(errors.baseShift)}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
              基本勤務曜日
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {BASE_WEEKDAY_OPTIONS.map((day) => {
                const checked = values.BaseWorkingDays.includes(day.value);
                return (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleBaseWorkingDay(day.value)}
                        size="small"
                      />
                    }
                    label={day.label}
                    sx={{
                      border: '1px solid',
                      borderColor: checked ? 'primary.main' : 'grey.300',
                      backgroundColor: checked ? 'primary.light' : 'transparent',
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      m: 0,
                      '& .MuiFormControlLabel-label': { fontSize: '0.875rem' }
                    }}
                  />
                );
              })}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              標準勤務時間を設定すると、シフト作成時の過剰割当を検知しやすくなります。
            </Typography>
          </Box>
        </Box>

        {/* 出勤曜日 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
            出勤曜日
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {DAYS.map((day) => {
              const checked = values.WorkDays.includes(day.value);
              return (
                <FormControlLabel
                  key={day.value}
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleWorkDay(day.value)}
                      size="small"
                    />
                  }
                  label={day.label}
                  sx={{
                    border: '1px solid',
                    borderColor: checked ? 'primary.main' : 'grey.300',
                    backgroundColor: checked ? 'primary.light' : 'transparent',
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    m: 0,
                    '& .MuiFormControlLabel-label': { fontSize: '0.875rem' }
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* 資格 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
            資格
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {CERTIFICATION_OPTIONS.map((option) => {
              const checked = values.Certifications.includes(option.value);
              return (
                <Chip
                  key={option.value}
                  label={option.label}
                  onClick={() => toggleCertification(option.value)}
                  variant={checked ? "filled" : "outlined"}
                  color={checked ? "primary" : "default"}
                  sx={{ cursor: 'pointer' }}
                />
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              label="カスタム資格を追加"
              value={customCertification}
              onChange={(event) => setCustomCertification(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddCustomCertification();
                }
              }}
              placeholder="例: 介護支援専門員"
              variant="outlined"
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleAddCustomCertification}
              disabled={!customCertification.trim()}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              追加
            </Button>
          </Box>
        {values.Certifications.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                選択された資格:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {values.Certifications.map((cert) => (
                  <Chip
                    key={cert}
                    label={cert}
                    onDelete={() => removeCertification(cert)}
                    color="success"
                    variant="filled"
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* 在籍ステータス */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={values.IsActive}
                onChange={(event) => setField("IsActive", event.target.checked)}
              />
            }
            label="在籍中"
          />
        </Box>

        {/* アクションボタン */}
        <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={{ minWidth: 120 }}
          >
            {mode === "create" ? "作成" : "保存"}
          </Button>

          {onClose && (
            <Button
              type="button"
              variant="outlined"
              onClick={handleClose}
              disabled={isSaving}
              startIcon={<CloseIcon />}
            >
              閉じる
            </Button>
          )}
        </Box>

        {/* Success Snackbar */}
        <Snackbar
          open={message?.type === "success"}
          autoHideDuration={3000}
          onClose={() => setMessage(null)}
        >
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message?.text}
          </Alert>
        </Snackbar>
      </form>
    </Paper>
  );
}

export default StaffForm;
