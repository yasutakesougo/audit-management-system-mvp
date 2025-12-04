import CloseIcon from '@mui/icons-material/Close';
import TransportIcon from '@mui/icons-material/DirectionsBus';
import MedicalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
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
    MenuItem,
    Paper,
    Snackbar,
    TextField,
    Typography,
} from "@mui/material";
import { ChangeEvent, createRef, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IUserMaster, IUserMasterCreateDto } from "../../sharepoint/fields";
import { useUsersStore } from "./store";

type UserFormProps = {
  user?: IUserMaster;
  mode?: "create" | "update";
  onSuccess?: (user: IUserMaster) => void;
  onDone?: (user: IUserMaster) => void;
  onClose?: () => void;
};

type MessageState = { type: "success" | "error"; text: string } | null;

type FormValues = {
  FullName: string;
  Furigana: string;
  FullNameKana: string;
  ContractDate: string;
  ServiceStartDate: string;
  ServiceEndDate: string;
  IsHighIntensitySupportTarget: boolean;
  IsSupportProcedureTarget: boolean;
  IsActive: boolean;
  TransportToDays: string[];
  TransportFromDays: string[];
  AttendanceDays: string[];
  RecipientCertNumber: string;
  RecipientCertExpiry: string;

  // 事業所との契約情報 / 利用ステータス
  UsageStatus: string;

  // 支給決定情報
  GrantMunicipality: string;
  GrantPeriodStart: string;
  GrantPeriodEnd: string;
  DisabilitySupportLevel: string;
  GrantedDaysPerMonth: string;
  UserCopayLimit: string;

  // 請求・加算関連情報
  TransportAdditionType: string;
  MealAddition: string;
  CopayPaymentMethod: string;
};

type Errors = Partial<
  Record<
    "fullName" | "furigana" | "certNumber" | "dates" | "grantPeriod",
    string
  >
>;

const WEEKDAYS = [
  { value: "月", label: "月" },
  { value: "火", label: "火" },
  { value: "水", label: "水" },
  { value: "木", label: "木" },
  { value: "金", label: "金" },
];

const USAGE_STATUS_OPTIONS = [
  { value: "", label: "（未選択）" },
  { value: "利用中", label: "利用中" },
  { value: "契約済・利用開始待ち", label: "契約済・利用開始待ち" },
  { value: "利用休止中", label: "利用休止中" },
  { value: "契約終了", label: "契約終了" },
];

const DISABILITY_SUPPORT_LEVEL_OPTIONS = [
  { value: "", label: "（未選択）" },
  { value: "none", label: "非該当" },
  { value: "1", label: "区分1" },
  { value: "2", label: "区分2" },
  { value: "3", label: "区分3" },
  { value: "4", label: "区分4" },
  { value: "5", label: "区分5" },
  { value: "6", label: "区分6" },
];

const TRANSPORT_ADDITION_OPTIONS = [
  { value: "", label: "（未選択）" },
  { value: "both", label: "往復利用" },
  { value: "oneway-to", label: "片道（往）のみ" },
  { value: "oneway-from", label: "片道（復）のみ" },
  { value: "none", label: "利用なし" },
];

const MEAL_ADDITION_OPTIONS = [
  { value: "", label: "（未選択）" },
  { value: "use", label: "利用する" },
  { value: "not-use", label: "利用しない" },
];

const COPAY_METHOD_OPTIONS = [
  { value: "", label: "（未選択）" },
  { value: "bank", label: "口座振替" },
  { value: "cash-office", label: "現金（事業所）" },
  { value: "cash-transport", label: "現金（送迎時）" },
];

const sanitize = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toCreateDto = (values: FormValues): IUserMasterCreateDto => ({
  FullName: values.FullName.trim(),
  Furigana: sanitize(values.Furigana) || null,
  FullNameKana: sanitize(values.FullNameKana) || null,
  ContractDate: sanitize(values.ContractDate) || null,
  ServiceStartDate: sanitize(values.ServiceStartDate) || null,
  ServiceEndDate: sanitize(values.ServiceEndDate) || null,
  IsHighIntensitySupportTarget: values.IsHighIntensitySupportTarget,
  IsSupportProcedureTarget: values.IsSupportProcedureTarget,
  severeFlag: false, // 重度区分は現状使用しないため固定値
  IsActive: values.IsActive,
  TransportToDays: values.TransportToDays.length ? values.TransportToDays : null,
  TransportFromDays: values.TransportFromDays.length ? values.TransportFromDays : null,
  AttendanceDays: values.AttendanceDays.length ? values.AttendanceDays : null,
  RecipientCertNumber: sanitize(values.RecipientCertNumber) || null,
  RecipientCertExpiry: sanitize(values.RecipientCertExpiry) || null,

  // 事業所との契約情報 / 利用ステータス
  UsageStatus: sanitize(values.UsageStatus) || null,

  // 支給決定情報
  GrantMunicipality: sanitize(values.GrantMunicipality) || null,
  GrantPeriodStart: sanitize(values.GrantPeriodStart) || null,
  GrantPeriodEnd: sanitize(values.GrantPeriodEnd) || null,
  DisabilitySupportLevel: sanitize(values.DisabilitySupportLevel) || null,
  GrantedDaysPerMonth: sanitize(values.GrantedDaysPerMonth) || null,
  UserCopayLimit: sanitize(values.UserCopayLimit) || null,

  // 請求・加算関連情報
  TransportAdditionType: sanitize(values.TransportAdditionType) || null,
  MealAddition: sanitize(values.MealAddition) || null,
  CopayPaymentMethod: sanitize(values.CopayPaymentMethod) || null,
});

export function UserForm({ user, mode = user ? "update" : "create", onSuccess, onDone, onClose }: UserFormProps) {
  const { create, update: updateUser } = useUsersStore();

  const deriveInitialValues = useCallback(
    (): FormValues => ({
      FullName: user?.FullName ?? "",
      Furigana: user?.Furigana ?? "",
      FullNameKana: user?.FullNameKana ?? "",
      ContractDate: user?.ContractDate ?? "",
      ServiceStartDate: user?.ServiceStartDate ?? "",
      ServiceEndDate: user?.ServiceEndDate ?? "",
      IsHighIntensitySupportTarget: user?.IsHighIntensitySupportTarget ?? false,
      IsSupportProcedureTarget: user?.IsSupportProcedureTarget ??
        user?.IsHighIntensitySupportTarget ?? false,
      IsActive: user?.IsActive ?? true,
      TransportToDays: [...(user?.TransportToDays ?? [])],
      TransportFromDays: [...(user?.TransportFromDays ?? [])],
      AttendanceDays: [...(user?.AttendanceDays ?? [])],
      RecipientCertNumber: user?.RecipientCertNumber ?? "",
      RecipientCertExpiry: user?.RecipientCertExpiry ?? "",

      UsageStatus:
        user?.UsageStatus ??
        (user?.IsActive === false ? "契約終了" : "利用中"),

      GrantMunicipality: user?.GrantMunicipality ?? "",
      GrantPeriodStart: user?.GrantPeriodStart ?? "",
      GrantPeriodEnd: user?.GrantPeriodEnd ?? "",
      DisabilitySupportLevel: user?.DisabilitySupportLevel ?? "",
      GrantedDaysPerMonth: user?.GrantedDaysPerMonth ?? "",
      UserCopayLimit: user?.UserCopayLimit ?? "",

      TransportAdditionType: user?.TransportAdditionType ?? "",
      MealAddition: user?.MealAddition ?? "",
      CopayPaymentMethod: user?.CopayPaymentMethod ?? "",
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
  const confirmDialogTimer = useRef<number | null>(null);

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
      furigana: createRef<HTMLInputElement>(),
      certNumber: createRef<HTMLInputElement>(),
    }),
    []
  );

  const focusFirstInvalid = useCallback(
    (nextErrors: Errors) => {
      const order: Array<keyof typeof errRefs> = ["fullName", "furigana", "certNumber"];
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

  const validate = useCallback((next: FormValues): Errors => {
    const errs: Errors = {};
    if (!next.FullName.trim()) {
      errs.fullName = "氏名は必須です";
    }
    const startDate = next.ServiceStartDate.trim();
    const endDate = next.ServiceEndDate.trim();
    if (startDate && endDate && endDate <= startDate) {
      errs.dates = "サービス終了日は開始日より後にしてください";
    }

    const grantStart = next.GrantPeriodStart.trim();
    const grantEnd = next.GrantPeriodEnd.trim();
    if (grantStart && grantEnd && grantEnd <= grantStart) {
      errs.grantPeriod = "支給決定期間の終了日は開始日より後にしてください";
    }

    return errs;
  }, []);

  const blurActiveElement = () => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }

    const body = document.body as HTMLElement | null;
    if (body) {
      const hadTabIndex = body.hasAttribute("tabindex");
      if (!hadTabIndex) {
        body.setAttribute("tabindex", "-1");
      }
      body.focus();
      if (!hadTabIndex) {
        body.removeAttribute("tabindex");
      }
    }
  };

  useEffect(() => {
    return () => {
      if (confirmDialogTimer.current !== null) {
        window.clearTimeout(confirmDialogTimer.current);
      }
    };
  }, []);

  const handleClose = () => {
    console.log('UserForm handleClose called, isDirty:', isDirty);
    blurActiveElement();
    if (isDirty) {
      if (confirmDialogTimer.current !== null) {
        window.clearTimeout(confirmDialogTimer.current);
      }
      confirmDialogTimer.current = window.setTimeout(() => {
        setShowConfirmDialog(true);
      }, 0);
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

  // いずれかのフラグがオンなら両方そろえる
  useEffect(() => {
    if (values.IsHighIntensitySupportTarget === values.IsSupportProcedureTarget) {
      return;
    }

    setValues((prev) => {
      const nextValue = prev.IsHighIntensitySupportTarget || prev.IsSupportProcedureTarget;
      return {
        ...prev,
        IsHighIntensitySupportTarget: nextValue,
        IsSupportProcedureTarget: nextValue,
      };
    });
  }, [values.IsHighIntensitySupportTarget, values.IsSupportProcedureTarget]);

  const handleSupportTargetToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    setValues((prev) => ({
      ...prev,
      IsHighIntensitySupportTarget: nextValue,
      IsSupportProcedureTarget: nextValue,
    }));
  }, []);

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
            FullName: "",
            Furigana: "",
            FullNameKana: "",
            ContractDate: "",
            ServiceStartDate: "",
            ServiceEndDate: "",
            IsHighIntensitySupportTarget: false,
            IsSupportProcedureTarget: false,
            IsActive: true,
            TransportToDays: [],
            TransportFromDays: [],
            AttendanceDays: [],
            RecipientCertNumber: "",
            RecipientCertExpiry: "",

            UsageStatus: "",
            GrantMunicipality: "",
            GrantPeriodStart: "",
            GrantPeriodEnd: "",
            DisabilitySupportLevel: "",
            GrantedDaysPerMonth: "",
            UserCopayLimit: "",
            TransportAdditionType: "",
            MealAddition: "",
            CopayPaymentMethod: "",
          };
          setValues(cleared);
          initialJson.current = JSON.stringify(cleared);
        } else if (mode === "update" && user) {
          if (user.Id == null) {
            throw new Error("更新対象の利用者IDが指定されていません。");
          }
          result = await updateUser(user.Id, payload);
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
    [create, focusFirstInvalid, mode, onDone, onSuccess, updateUser, user, validate, values]
  );

  const systemAssignedCode =
    mode === 'create'
      ? '保存後に自動採番されます'
      : user?.UserID ?? '未採番';

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
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              利用者コード（システム採番）：{systemAssignedCode}
            </Typography>

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
          <Typography
            variant="h6"
            sx={{
              mb: 2,
              color: "primary.main",
              display: "flex",
              alignItems: "center",
            }}
          >
            <MedicalIcon sx={{ mr: 1 }} />
            契約・サービス情報
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* 事業所との契約情報 */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
                事業所との契約情報
              </Typography>

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
                onChange={(event) =>
                  setField("ServiceStartDate", event.target.value)
                }
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                label="サービス終了日"
                type="date"
                value={values.ServiceEndDate}
                onChange={(event) =>
                  setField("ServiceEndDate", event.target.value)
                }
                error={Boolean(errors.dates)}
                helperText={errors.dates}
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                label="利用ステータス"
                select
                size="small"
                value={values.UsageStatus}
                onChange={(event) =>
                  setField("UsageStatus", event.target.value)
                }
                helperText="請求対象者の抽出や稼働率集計に使用します"
              >
                {USAGE_STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* 支給決定情報 */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
                支給決定情報（受給者証）
              </Typography>

              <TextField
                fullWidth
                label="支給決定市町村"
                value={values.GrantMunicipality}
                onChange={(event) =>
                  setField("GrantMunicipality", event.target.value)
                }
                placeholder="例：横浜市磯子区"
                variant="outlined"
                size="small"
              />

              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                  fullWidth
                  label="支給決定期間（開始）"
                  type="date"
                  value={values.GrantPeriodStart}
                  onChange={(event) =>
                    setField("GrantPeriodStart", event.target.value)
                  }
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.grantPeriod)}
                />
                <TextField
                  fullWidth
                  label="支給決定期間（終了）"
                  type="date"
                  value={values.GrantPeriodEnd}
                  onChange={(event) =>
                    setField("GrantPeriodEnd", event.target.value)
                  }
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.grantPeriod)}
                  helperText={errors.grantPeriod}
                />
              </Box>

              <TextField
                fullWidth
                label="障害支援区分"
                select
                size="small"
                value={values.DisabilitySupportLevel}
                onChange={(event) =>
                  setField("DisabilitySupportLevel", event.target.value)
                }
                helperText="生活介護の基本報酬単価の算定に使用します"
              >
                {DISABILITY_SUPPORT_LEVEL_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                label="契約支給量（日数／月）"
                value={values.GrantedDaysPerMonth}
                onChange={(event) =>
                  setField("GrantedDaysPerMonth", event.target.value)
                }
                placeholder="例：20"
                variant="outlined"
                size="small"
                helperText="1ヶ月あたりに利用が認められた日数（例：20日／月）"
              />

              <TextField
                fullWidth
                label="利用者負担上限月額（円）"
                value={values.UserCopayLimit}
                onChange={(event) =>
                  setField("UserCopayLimit", event.target.value)
                }
                placeholder="例：9300"
                variant="outlined"
                size="small"
                helperText="受給者証に記載の「利用者負担上限月額」です"
              />

              <TextField
                fullWidth
                label="受給者証番号"
                inputRef={errRefs.certNumber}
                value={values.RecipientCertNumber}
                onChange={(event) =>
                  setField("RecipientCertNumber", event.target.value)
                }
                placeholder="1234567890"
                variant="outlined"
                size="small"
              />

              <TextField
                fullWidth
                label="受給者証有効期限"
                type="date"
                value={values.RecipientCertExpiry}
                onChange={(event) =>
                  setField("RecipientCertExpiry", event.target.value)
                }
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
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
          <Typography
            variant="h6"
            sx={{ mb: 2, color: "primary.main" }}
          >
            支援区分・ステータス
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: "text.secondary" }}
            >
              基本ステータス
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsHighIntensitySupportTarget}
                  onChange={handleSupportTargetToggle}
                />
              }
              label="強度行動障害支援対象者"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsActive}
                  onChange={(event) =>
                    setField("IsActive", event.target.checked)
                  }
                />
              }
              label="利用中フラグ（システム内部用）"
            />
          </Box>

          <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: "text.secondary" }}
            >
              請求・加算情報
            </Typography>

            <TextField
              fullWidth
              label="送迎加算区分"
              select
              size="small"
              value={values.TransportAdditionType}
              onChange={(event) =>
                setField("TransportAdditionType", event.target.value)
              }
              helperText="送迎加算の請求区分（往復／片道／なし）"
            >
              {TRANSPORT_ADDITION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="食事提供体制加算"
              select
              size="small"
              value={values.MealAddition}
              onChange={(event) =>
                setField("MealAddition", event.target.value)
              }
            >
              {MEAL_ADDITION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="利用者負担金支払方法"
              select
              size="small"
              value={values.CopayPaymentMethod}
              onChange={(event) =>
                setField("CopayPaymentMethod", event.target.value)
              }
            >
              {COPAY_METHOD_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
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