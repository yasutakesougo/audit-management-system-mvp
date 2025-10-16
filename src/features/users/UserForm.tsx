import {
    Close as CloseIcon,
    LocalHospital as MedicalIcon,
    Person as PersonIcon,
    Save as SaveIcon,
    DirectionsBus as TransportIcon,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Paper,
    Snackbar,
    TextField,
    Typography,
} from "@mui/material";
import { createRef, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUsersStore } from "./store";
import type { IUserMaster, IUserMasterCreateDto } from "./types";

type UserFormProps = {
  user?: IUserMaster;
  mode?: "create" | "update";
  onSuccess?: (user: IUserMaster) => void;
  onDone?: (user: IUserMaster) => void;
  onClose?: () => void;
};

type MessageState = { type: "success" | "error"; text: string } | null;

type FormValues = {
  UserID: string;
  FullName: string;
  Furigana: string;
  FullNameKana: string;
  ContractDate: string;
  ServiceStartDate: string;
  ServiceEndDate: string;
  IsHighIntensitySupportTarget: boolean;
  IsActive: boolean;
  TransportToDays: string[];
  TransportFromDays: string[];
  AttendanceDays: string[];
  RecipientCertNumber: string;
  RecipientCertExpiry: string;
};

type Errors = Partial<Record<"userID" | "fullName" | "furigana" | "certNumber" | "dates", string>>;

const WEEKDAYS = [
  { value: "月", label: "月" },
  { value: "火", label: "火" },
  { value: "水", label: "水" },
  { value: "木", label: "木" },
  { value: "金", label: "金" },
];

const sanitize = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toCreateDto = (values: FormValues): IUserMasterCreateDto => ({
  UserID: values.UserID.trim(),
  FullName: values.FullName.trim(),
  Furigana: sanitize(values.Furigana) || null,
  FullNameKana: sanitize(values.FullNameKana) || null,
  ContractDate: sanitize(values.ContractDate) || null,
  ServiceStartDate: sanitize(values.ServiceStartDate) || null,
  ServiceEndDate: sanitize(values.ServiceEndDate) || null,
  IsHighIntensitySupportTarget: values.IsHighIntensitySupportTarget,
  severeFlag: false, // 重度区分は現状使用しないため固定値
  IsActive: values.IsActive,
  TransportToDays: values.TransportToDays.length ? values.TransportToDays : null,
  TransportFromDays: values.TransportFromDays.length ? values.TransportFromDays : null,
  AttendanceDays: values.AttendanceDays.length ? values.AttendanceDays : null,
  RecipientCertNumber: sanitize(values.RecipientCertNumber) || null,
  RecipientCertExpiry: sanitize(values.RecipientCertExpiry) || null,
});

export function UserForm({ user, mode = user ? "update" : "create", onSuccess, onDone, onClose }: UserFormProps) {
  const { create, data: existingUsers } = useUsersStore();

  const deriveInitialValues = useCallback(
    (): FormValues => ({
      UserID: user?.UserID ?? "",
      FullName: user?.FullName ?? "",
      Furigana: user?.Furigana ?? "",
      FullNameKana: user?.FullNameKana ?? "",
      ContractDate: user?.ContractDate ?? "",
      ServiceStartDate: user?.ServiceStartDate ?? "",
      ServiceEndDate: user?.ServiceEndDate ?? "",
      IsHighIntensitySupportTarget: user?.IsHighIntensitySupportTarget ?? false,
      IsActive: user?.IsActive ?? true,
      TransportToDays: [...(user?.TransportToDays ?? [])],
      TransportFromDays: [...(user?.TransportFromDays ?? [])],
      AttendanceDays: [...(user?.AttendanceDays ?? [])],
      RecipientCertNumber: user?.RecipientCertNumber ?? "",
      RecipientCertExpiry: user?.RecipientCertExpiry ?? "",
    }),
    [user]
  );

  const [values, setValues] = useState<FormValues>(() => deriveInitialValues());
  const [errors, setErrors] = useState<Errors>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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
      userID: createRef<HTMLInputElement>(),
      fullName: createRef<HTMLInputElement>(),
      furigana: createRef<HTMLInputElement>(),
      certNumber: createRef<HTMLInputElement>(),
    }),
    []
  );

  const focusFirstInvalid = useCallback(
    (nextErrors: Errors) => {
      const order: Array<keyof typeof errRefs> = ["userID", "fullName", "furigana", "certNumber"];
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
      if (!next.UserID.trim()) {
        errs.userID = "利用者IDは必須です";
      }
      if (!next.FullName.trim()) {
        errs.fullName = "氏名は必須です";
      }
      const startDate = next.ServiceStartDate.trim();
      const endDate = next.ServiceEndDate.trim();
      if (startDate && endDate && endDate <= startDate) {
        errs.dates = "サービス終了日は開始日より後にしてください";
      }
      return errs;
    },
    []
  );

  const handleClose = () => {
    console.log('UserForm handleClose called, isDirty:', isDirty);
    if (isDirty) {
      setShowConfirmDialog(true);
    } else {
      console.log('Calling onClose callback');
      onClose?.();
    }
  };

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

  const toggleDay = useCallback((day: string, field: 'TransportToDays' | 'TransportFromDays' | 'AttendanceDays') => {
    setValues((prev) => {
      const set = new Set(prev[field]);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      const ordered = WEEKDAYS.map((d) => d.value).filter((d) => set.has(d));
      return { ...prev, [field]: ordered };
    });
  }, []);

  // 利用者ID自動生成
  const generateUserID = useCallback(() => {
    const existingIds = existingUsers.map(user => user.UserID).filter(Boolean);

    // U-001, U-002, U-003... の形式で連番を生成
    let nextNumber = 1;
    let newId = '';

    do {
      newId = `U-${nextNumber.toString().padStart(3, '0')}`;
      nextNumber++;
    } while (existingIds.includes(newId));

    setField('UserID', newId);
  }, [existingUsers, setField]);

  // 新規作成時に利用者IDを自動生成
  useEffect(() => {
    if (mode === 'create' && !values.UserID && existingUsers.length >= 0) {
      generateUserID();
    }
  }, [mode, values.UserID, existingUsers.length, generateUserID]);

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

      const payload = toCreateDto(values);

      try {
        let result: IUserMaster | null = null;
        if (mode === "create") {
          result = await create(payload);
          const cleared: FormValues = {
            UserID: "",
            FullName: "",
            Furigana: "",
            FullNameKana: "",
            ContractDate: "",
            ServiceStartDate: "",
            ServiceEndDate: "",
            IsHighIntensitySupportTarget: false,
            IsActive: true,
            TransportToDays: [],
            TransportFromDays: [],
            AttendanceDays: [],
            RecipientCertNumber: "",
            RecipientCertExpiry: "",
          };
          setValues(cleared);
          initialJson.current = JSON.stringify(cleared);
        } else if (mode === "update" && user) {
          // Note: update functionality would need to be implemented in the store
          // result = await update(user.Id, payload);
          result = user; // Placeholder
          initialJson.current = JSON.stringify(values);
        } else {
          throw new Error("更新対象の利用者IDが指定されていません。");
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
    [create, focusFirstInvalid, mode, onDone, onSuccess, user, validate, values]
  );

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6" component="h2">
            {mode === 'create' ? '新規利用者登録' : '利用者情報編集'}
          </Typography>
        </Box>
        {onClose && (
          <IconButton
            onClick={handleClose}
            size="small"
            aria-label="フォームを閉じる"
            tabIndex={0}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <form
        ref={formRef}
        data-form="user"
        onSubmit={handleSubmit}
        role="form"
        aria-label={mode === 'create' ? '新規利用者登録フォーム' : '利用者情報編集フォーム'}
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
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                required
                label="利用者ID"
                inputRef={errRefs.userID}
                value={values.UserID}
                onChange={(event) => setField("UserID", event.target.value)}
                error={Boolean(errors.userID)}
                helperText={errors.userID || (mode === 'create' ? '自動生成ボタンを使用するか手動入力してください' : '')}
                placeholder="例: U-001"
                variant="outlined"
                size="small"
              />
              {mode === 'create' && (
                <Button
                  variant="outlined"
                  onClick={generateUserID}
                  sx={{ minWidth: 'auto', px: 2, py: 1 }}
                  size="small"
                >
                  自動生成
                </Button>
              )}
            </Box>

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

            <TextField
              fullWidth
              label="ふりがな"
              inputRef={errRefs.furigana}
              value={values.Furigana}
              onChange={(event) => setField("Furigana", event.target.value)}
              placeholder="やまだ たろう"
              variant="outlined"
              size="small"
            />

            <TextField
              fullWidth
              label="カタカナ氏名"
              value={values.FullNameKana}
              onChange={(event) => setField("FullNameKana", event.target.value)}
              placeholder="ヤマダ タロウ"
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>

        {/* 契約・サービス情報 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
            <MedicalIcon sx={{ mr: 1 }} />
            契約・サービス情報
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="契約日"
              type="date"
              value={values.ContractDate}
              onChange={(event) => setField("ContractDate", event.target.value)}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="サービス開始日"
              type="date"
              value={values.ServiceStartDate}
              onChange={(event) => setField("ServiceStartDate", event.target.value)}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="サービス終了日"
              type="date"
              value={values.ServiceEndDate}
              onChange={(event) => setField("ServiceEndDate", event.target.value)}
              error={Boolean(errors.dates)}
              helperText={errors.dates}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="受給者証番号"
              inputRef={errRefs.certNumber}
              value={values.RecipientCertNumber}
              onChange={(event) => setField("RecipientCertNumber", event.target.value)}
              placeholder="1234567890"
              variant="outlined"
              size="small"
            />

            <TextField
              fullWidth
              label="受給者証有効期限"
              type="date"
              value={values.RecipientCertExpiry}
              onChange={(event) => setField("RecipientCertExpiry", event.target.value)}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </Box>

        {/* 送迎・通所情報 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
            <TransportIcon sx={{ mr: 1 }} />
            送迎・通所情報
          </Typography>

          {/* 送迎（往路） */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
              送迎（往路）
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {WEEKDAYS.map((day) => {
                const checked = values.TransportToDays.includes(day.value);
                return (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleDay(day.value, 'TransportToDays')}
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

          {/* 送迎（復路） */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
              送迎（復路）
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {WEEKDAYS.map((day) => {
                const checked = values.TransportFromDays.includes(day.value);
                return (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleDay(day.value, 'TransportFromDays')}
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

          {/* 通所予定日 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
              通所予定日
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {WEEKDAYS.map((day) => {
                const checked = values.AttendanceDays.includes(day.value);
                return (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleDay(day.value, 'AttendanceDays')}
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
        </Box>

        {/* 支援区分・ステータス */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
            支援区分・ステータス
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsHighIntensitySupportTarget}
                  onChange={(event) => setField("IsHighIntensitySupportTarget", event.target.checked)}
                />
              }
              label="強度行動障害支援対象者"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsActive}
                  onChange={(event) => setField("IsActive", event.target.checked)}
                />
              }
              label="利用中"
            />
          </Box>
        </Box>

        {/* アクションボタン */}
        <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={{ minWidth: 120 }}
            tabIndex={0}
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
              tabIndex={0}
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

        {/* 確認ダイアログ */}
        <Dialog
          open={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          maxWidth="sm"
        >
          <DialogTitle>未保存の変更があります</DialogTitle>
          <DialogContent>
            <DialogContentText>
              フォームに未保存の変更があります。保存せずに閉じますか？
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowConfirmDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false);
                onClose?.();
              }}
              color="error"
            >
              閉じる
            </Button>
          </DialogActions>
        </Dialog>
      </form>
    </Paper>
  );
}

export default UserForm;