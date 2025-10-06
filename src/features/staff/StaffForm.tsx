import { createRef, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStaff } from "@/stores/useStaff";
import type { Staff, StaffUpsert } from "@/types";

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

const Spinner = () => (
  <span
    className="inline-block h-4 w-4 animate-spin rounded-full border border-current border-t-transparent align-[-2px]"
    aria-hidden="true"
  />
);

const Toast = ({ text, onDone }: { text: string; onDone?: () => void }) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setOpen(false);
      onDone?.();
    }, 2200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (!open) return null;

  return <div className="fixed right-3 top-3 z-[9999] rounded-md bg-black/85 px-3 py-2 text-sm text-white shadow">{text}</div>;
};

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
    <form
      ref={formRef}
      data-form="staff"
      onSubmit={handleSubmit}
      aria-busy={isSaving}
      className="grid gap-4 rounded-md bg-white p-4 shadow"
    >
      {message && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-1">
        <label htmlFor="staff-id" className="text-sm font-medium text-gray-700">
          スタッフID
        </label>
        <input
          id="staff-id"
          value={values.StaffID}
          onChange={(event) => setField("StaffID", event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="例: ST-001"
          autoComplete="off"
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="full-name" className="text-sm font-medium text-gray-700">
          氏名
        </label>
        <input
          id="full-name"
          ref={errRefs.fullName}
          value={values.FullName}
          onChange={(event) => setField("FullName", event.target.value)}
          className={`rounded-md border px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
            errors.fullName ? "border-red-500" : "border-gray-300"
          }`}
          data-invalid={Boolean(errors.fullName)}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "err-full-name" : undefined}
          placeholder="山田 太郎"
        />
        {errors.fullName && (
          <p id="err-full-name" className="text-xs text-red-600">
            {errors.fullName}
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          メール
        </label>
        <input
          id="email"
          type="email"
          ref={errRefs.email}
          value={values.Email}
          onChange={(event) => setField("Email", event.target.value)}
          className={`rounded-md border px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
            errors.email ? "border-red-500" : "border-gray-300"
          }`}
          data-invalid={Boolean(errors.email)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "err-email" : undefined}
          placeholder="taro.yamada@example.com"
          autoComplete="email"
        />
        {errors.email && (
          <p id="err-email" className="text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          電話番号
        </label>
        <input
          id="phone"
          ref={errRefs.phone}
          value={values.Phone}
          onChange={(event) => setField("Phone", event.target.value)}
          className={`rounded-md border px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
            errors.phone ? "border-red-500" : "border-gray-300"
          }`}
          data-invalid={Boolean(errors.phone)}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "err-phone" : undefined}
          placeholder="09012345678"
          autoComplete="tel"
        />
        {errors.phone && (
          <p id="err-phone" className="text-xs text-red-600">
            {errors.phone}
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <label htmlFor="role" className="text-sm font-medium text-gray-700">
          役職
        </label>
        <input
          id="role"
          value={values.Role}
          onChange={(event) => setField("Role", event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="サービス管理責任者"
        />
      </div>

      <fieldset className="grid gap-2 rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-sm font-semibold text-gray-700">基本勤務パターン</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="base-shift-start" className="text-sm font-medium text-gray-700">
              開始時刻
            </label>
            <input
              id="base-shift-start"
              type="time"
              ref={errRefs.baseShift}
              value={values.BaseShiftStartTime}
              onChange={(event) => setField("BaseShiftStartTime", event.target.value)}
              className={`rounded-md border px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                errors.baseShift ? "border-red-500" : "border-gray-300"
              }`}
              step={300}
              aria-invalid={Boolean(errors.baseShift)}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="base-shift-end" className="text-sm font-medium text-gray-700">
              終了時刻
            </label>
            <input
              id="base-shift-end"
              type="time"
              value={values.BaseShiftEndTime}
              onChange={(event) => setField("BaseShiftEndTime", event.target.value)}
              className={`rounded-md border px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                errors.baseShift ? "border-red-500" : "border-gray-300"
              }`}
              step={300}
              aria-invalid={Boolean(errors.baseShift)}
            />
          </div>
        </div>
        <div className="grid gap-1">
          <span className="text-sm font-medium text-gray-700">勤務曜日</span>
          <div className="flex flex-wrap gap-2">
            {BASE_WEEKDAY_OPTIONS.map((day) => {
              const checked = values.BaseWorkingDays.includes(day.value);
              return (
                <label
                  key={day.value}
                  className={`inline-flex items-center gap-2 rounded border px-2 py-1 ${
                    checked ? "border-indigo-500 bg-indigo-50" : "border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBaseWorkingDay(day.value)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{day.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        {errors.baseShift ? (
          <p className="text-xs text-red-600">{errors.baseShift}</p>
        ) : (
          <p className="text-xs text-gray-500">標準勤務時間を設定すると、シフト作成時の過剰割当を検知しやすくなります。</p>
        )}
      </fieldset>

      <div className="grid gap-1">
        <span className="text-sm font-medium text-gray-700">出勤曜日</span>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => {
            const checked = values.WorkDays.includes(day.value);
            return (
              <label
                key={day.value}
                className={`inline-flex items-center gap-2 rounded border px-2 py-1 ${
                  checked ? "border-indigo-500 bg-indigo-50" : "border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleWorkDay(day.value)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{day.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1">
        <span className="text-sm font-medium text-gray-700">資格</span>
        <div className="flex flex-wrap gap-2">
          {CERTIFICATION_OPTIONS.map((option) => {
            const checked = values.Certifications.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleCertification(option.value)}
                className={`inline-flex items-center gap-2 rounded border px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                  checked ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-300 text-gray-700"
                }`}
              >
                <span aria-hidden="true">{checked ? "✓" : ""}</span>
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <input
            value={customCertification}
            onChange={(event) => setCustomCertification(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddCustomCertification();
              }
            }}
            placeholder="例: 介護支援専門員"
            aria-label="資格を追加"
            className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddCustomCertification}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            追加
          </button>
        </div>
        {values.Certifications.length ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {values.Certifications.map((cert) => (
              <span
                key={cert}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {cert}
                <button
                  type="button"
                  onClick={() => removeCertification(cert)}
                  className="rounded-full bg-white/60 px-1 text-xs text-gray-500 transition hover:bg-white hover:text-gray-700"
                  aria-label={`${cert} を削除`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">資格を追加してください（例: 普通運転免許）。</p>
        )}
      </div>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.IsActive}
          onChange={(event) => setField("IsActive", event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-700">在籍中</span>
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSaving}
          aria-disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {isSaving ? <Spinner /> : null}
          {mode === "create" ? "作成" : "保存"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-disabled={isSaving}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
          >
            閉じる
          </button>
        )}
      </div>

      {message?.type === "success" ? <Toast text={message.text} onDone={() => setMessage(null)} /> : null}
    </form>
  );
}

export default StaffForm;
