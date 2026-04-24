import type { SelectChangeEvent } from '@mui/material/Select';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAnnounce } from '@/a11y/LiveAnnouncer';
import type {
    ScheduleCategory
} from '../../data';
import {
    buildAutoTitle,
    createInitialScheduleFormState,
    type ScheduleFormState,
    type ScheduleUserOption,
} from '../../domain/scheduleFormState';
import { useOrgOptions, type OrgOption } from '../useOrgOptions';
import { useStaffOptions, type StaffOption } from '../useStaffOptions';

// ===== Input Props =====

export type UseScheduleCreateFormInput = {
  open: boolean;
  onClose: () => void;
  users: ScheduleUserOption[];
  initialDate?: Date | string;
  initialStartTime?: string;
  initialEndTime?: string;
  defaultUser?: ScheduleUserOption | null;
  mode: 'create' | 'edit';
  eventId?: string;
  initialOverride?: Partial<ScheduleFormState> | null;
  dialogTestId?: string;
  externalErrors?: string[];
};

// ===== ViewModel =====

export interface ScheduleCreateFormViewModel {
  // State
  form: ScheduleFormState;
  errors: string[];
  showFacilityGuide: boolean;

  // Derived
  selectedUser: ScheduleUserOption | null;
  selectedStaffOption: StaffOption | null;
  selectedOrgOption: OrgOption | null;
  titleLabel: string;
  primaryButtonLabel: string;
  titlePlaceholder: string;
  titleHelperText: string | undefined;
  isOrgCategory: boolean;
  dateOrderErrorMessage: string | undefined;
  serviceTypeErrorMessage: string | undefined;
  autoTitleFromForm: string;

  // Refs
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  userInputRef: React.RefObject<HTMLInputElement | null>;
  staffInputRef: React.RefObject<HTMLInputElement | null>;

  // Handlers
  handleUserChange: (_event: unknown, value: ScheduleUserOption | null) => void;
  handleFieldChange: (field: keyof ScheduleFormState, value: string) => void;
  handleCategoryChange: (event: SelectChangeEvent<ScheduleCategory>) => void;
  handleStaffChange: (_event: unknown, option: StaffOption | null) => void;
  handleClose: () => void;

  // A11y
  headingId: string;
  descriptionId: string;
  dialogAriaDescribedBy: string;
  resolvedDialogTestId: string;
  errorSummaryId: string | undefined;

  // External options
  staffOptions: StaffOption[];
  orgOptions: OrgOption[];

  // Labels
  openAnnouncement: string;
}

// ===== Hook =====

export function useScheduleCreateForm(input: UseScheduleCreateFormInput): ScheduleCreateFormViewModel {
  const {
    open,
    onClose,
    users,
    initialDate,
    initialStartTime,
    initialEndTime,
    defaultUser,
    mode,
    eventId,
    initialOverride,
    dialogTestId,
    externalErrors = [],
  } = input;

  const resolvedDialogTestId = dialogTestId ?? 'schedule-create-dialog';
  const headingId = `${resolvedDialogTestId}-heading`;
  const descriptionId = `${resolvedDialogTestId}-description`;

  // ── Resolved default title ──────────────────────────────────────────────
  const resolvedDefaultTitle = useMemo(() => {
    if (initialOverride?.title?.trim()) return initialOverride.title;
    const candidateUserId = initialOverride?.userId ?? defaultUser?.id;
    const matchedUser = candidateUserId ? users.find((candidate) => candidate.id === candidateUserId) : undefined;
    if (mode === 'edit') {
      return matchedUser
        ? buildAutoTitle({
            userName: matchedUser.name,
            serviceType: initialOverride?.serviceType ?? '',
            assignedStaffId: initialOverride?.assignedStaffId ?? '',
            vehicleId: initialOverride?.vehicleId ?? '',
          })
        : '';
    }
    return buildAutoTitle({
      userName: matchedUser?.name ?? defaultUser?.name ?? undefined,
      serviceType: initialOverride?.serviceType ?? '',
      assignedStaffId: initialOverride?.assignedStaffId ?? '',
      vehicleId: initialOverride?.vehicleId ?? '',
    });
  }, [
    defaultUser?.id,
    defaultUser?.name,
    initialOverride?.title,
    initialOverride?.userId,
    initialOverride?.serviceType,
    initialOverride?.assignedStaffId,
    initialOverride?.vehicleId,
    mode,
    users
  ]);

  // ── Core state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState<ScheduleFormState>(() =>
    createInitialScheduleFormState({
      initialDate,
      initialStartTime,
      initialEndTime,
      defaultUserId: defaultUser?.id,
      defaultTitle: resolvedDefaultTitle,
      override: initialOverride ?? undefined
    })
  );
  const [showFacilityGuide, setShowFacilityGuide] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const userInputRef = useRef<HTMLInputElement | null>(null);
  const staffInputRef = useRef<HTMLInputElement | null>(null);
  const didAutoFocusRef = useRef(false);
  const announce = useAnnounce();
  const wasOpenRef = useRef(open);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // ── Derived a11y ────────────────────────────────────────────────────────
  const errorSummaryId = externalErrors.length > 0 ? `${resolvedDialogTestId}-errors` : undefined;
  const dialogAriaDescribedBy = errorSummaryId ? `${descriptionId} ${errorSummaryId}` : descriptionId;

  // ── External data hooks ─────────────────────────────────────────────────
  const staffOptions = useStaffOptions();
  const orgOptions = useOrgOptions();

  // ── Derived error messages ──────────────────────────────────────────────
  const dateOrderErrorMessage = useMemo(
    () => externalErrors.find((msg) => msg.includes('終了日時は開始日時より後にしてください')),
    [externalErrors],
  );
  const serviceTypeErrorMessage = useMemo(
    () => externalErrors.find((msg) => msg.includes('サービス種別を選択してください')),
    [externalErrors],
  );

  // ── Derived selections ──────────────────────────────────────────────────
  const selectedStaffOption = useMemo(() => {
    if (!form.assignedStaffId) return null;
    const numeric = Number(form.assignedStaffId);
    if (!Number.isFinite(numeric)) return null;
    return staffOptions.find((option) => option.id === numeric) ?? null;
  }, [form.assignedStaffId, staffOptions]);

  const selectedUser = useMemo(
    () => users.find(u => u.id === form.userId) ?? null,
    [users, form.userId]
  );

  const autoTitleFromForm = useMemo(() => {
    const currentUserName = users.find((u) => u.id === form.userId)?.name;
    return buildAutoTitle({
      userName: currentUserName,
      serviceType: form.serviceType,
      assignedStaffId: form.assignedStaffId,
      vehicleId: form.vehicleId,
    });
  }, [form.userId, form.serviceType, form.assignedStaffId, form.vehicleId, users]);

  const selectedOrgOption = useMemo(() => {
    if (!form.locationName) return null;
    return orgOptions.find((option) => option.label === form.locationName) ?? null;
  }, [form.locationName, orgOptions]);

  // ── Derived labels ──────────────────────────────────────────────────────
  const isOrgCategory = form.category === 'Org';
  const titleLabel = mode === 'edit' ? 'スケジュール更新' : 'スケジュール新規作成';
  const primaryButtonLabel = mode === 'edit' ? '更新' : '作成';
  const titlePlaceholder = isOrgCategory ? '例）会議：〇〇について' : '例）午前 利用者Aさん通所';
  const titleHelperText = isOrgCategory ? '施設全体イベントのタイトルを入力' : undefined;
  const openAnnouncement = useMemo(
    () => (mode === 'edit' ? 'スケジュール更新ダイアログを開きました。' : 'スケジュール新規作成ダイアログを開きました。'),
    [mode],
  );

  // ── Effects ─────────────────────────────────────────────────────────────

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm((prev) => {
        const next = createInitialScheduleFormState({
          initialDate,
          initialStartTime,
          initialEndTime,
          defaultUserId: defaultUser?.id,
          defaultTitle: resolvedDefaultTitle,
          override: initialOverride ?? undefined
        });
        if (mode === 'create' && prev.title && prev.title.trim() && prev.title !== resolvedDefaultTitle) {
          next.title = prev.title;
        }
        return next;
      });
    }
  }, [open, eventId, initialDate, initialStartTime, initialEndTime, defaultUser?.id, initialOverride, mode, resolvedDefaultTitle]);

  // Focus management on open/close
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open && !wasOpenRef.current) {
      const active = document.activeElement;
      lastFocusedRef.current = active instanceof HTMLElement ? active : null;
      announce(openAnnouncement);
    } else if (!open && wasOpenRef.current) {
      const target = lastFocusedRef.current;
      lastFocusedRef.current = null;
      window.setTimeout(() => {
        target?.focus();
      }, 0);
    }
    wasOpenRef.current = open;
  }, [announce, open, openAnnouncement]);

  // Auto-title sync
  useEffect(() => {
    setForm((prev) => {
      if (prev.title.trim()) return prev;
      return { ...prev, title: autoTitleFromForm };
    });
  }, [autoTitleFromForm]);

  // Auto-focus on open
  useEffect(() => {
    if (!open) {
      didAutoFocusRef.current = false;
      return;
    }
    if (didAutoFocusRef.current) return;
    const target =
      mode === 'edit' || isOrgCategory
        ? titleInputRef.current
        : form.category === 'User'
          ? userInputRef.current
          : form.category === 'Staff'
            ? staffInputRef.current
            : titleInputRef.current;
    if (target) {
      if (typeof window === 'undefined') {
        target.focus();
      } else {
        window.requestAnimationFrame(() => target.focus());
      }
      didAutoFocusRef.current = true;
    }
  }, [form.category, isOrgCategory, mode, open]);

  // Facility guide (one-time)
  useEffect(() => {
    if (!open) {
      setShowFacilityGuide(false);
      return;
    }
    if (!isOrgCategory) {
      setShowFacilityGuide(false);
      return;
    }
    if (typeof window === 'undefined') return;
    const storageKey = 'schedules.facilityGuideSeen.v1';
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (!seen) {
        setShowFacilityGuide(true);
        window.localStorage.setItem(storageKey, 'true');
      }
    } catch {
      setShowFacilityGuide(true);
    }
  }, [isOrgCategory, open]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleUserChange = (_event: unknown, value: ScheduleUserOption | null) => {
    setForm((prev) => {
      const prevUserName = users.find((u) => u.id === prev.userId)?.name ?? '';
      const prevAutoTitle = buildAutoTitle({
        userName: prevUserName,
        serviceType: prev.serviceType,
        assignedStaffId: prev.assignedStaffId,
        vehicleId: prev.vehicleId,
      });
      const shouldReplaceTitle = !prev.title.trim() || prev.title === prevAutoTitle;
      const nextAutoTitle = buildAutoTitle({
        userName: value?.name,
        serviceType: prev.serviceType,
        assignedStaffId: prev.assignedStaffId,
        vehicleId: prev.vehicleId,
      });
      return {
        ...prev,
        userId: value?.id ?? '',
        title: shouldReplaceTitle ? nextAutoTitle : prev.title,
      };
    });
  };

  const handleFieldChange = (field: keyof ScheduleFormState, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryChange = (event: SelectChangeEvent<ScheduleCategory>) => {
    const nextCategory = event.target.value as ScheduleCategory;
    setForm((prev) => {
      if (prev.category === nextCategory) return prev;

      // Build current auto-title to detect if title was auto-generated
      const prevUserName = users.find((u) => u.id === prev.userId)?.name ?? '';
      const prevAutoTitle = buildAutoTitle({
        userName: prevUserName,
        serviceType: prev.serviceType,
        assignedStaffId: prev.assignedStaffId,
        vehicleId: prev.vehicleId,
      });
      const shouldResetTitle = !prev.title.trim() || prev.title === prevAutoTitle;

      const next: ScheduleFormState = {
        ...prev,
        category: nextCategory,
      };
      if (nextCategory !== 'User') {
        next.userId = '';
      }
      if (nextCategory !== 'Staff') {
        next.assignedStaffId = '';
      }

      // Rebuild auto-title with cleared fields
      if (shouldResetTitle) {
        const nextUserName = nextCategory === 'User' ? prevUserName : '';
        const nextStaffId = nextCategory === 'Staff' ? next.assignedStaffId : '';
        next.title = buildAutoTitle({
          userName: nextUserName || undefined,
          serviceType: next.serviceType,
          assignedStaffId: nextStaffId,
          vehicleId: next.vehicleId,
        });
      }

      return next;
    });
  };

  const handleStaffChange = (_event: unknown, option: StaffOption | null) => {
    setForm((prev) => {
      const currentUserName = users.find((u) => u.id === prev.userId)?.name ?? '';
      const prevAutoTitle = buildAutoTitle({
        userName: currentUserName,
        serviceType: prev.serviceType,
        assignedStaffId: prev.assignedStaffId,
        vehicleId: prev.vehicleId,
      });
      const shouldReplaceTitle = !prev.title.trim() || prev.title === prevAutoTitle;
      const nextAssignedStaffId = option ? String(option.id) : '';
      const nextAutoTitle = buildAutoTitle({
        userName: currentUserName,
        serviceType: prev.serviceType,
        assignedStaffId: nextAssignedStaffId,
        vehicleId: prev.vehicleId,
      });
      return {
        ...prev,
        assignedStaffId: nextAssignedStaffId,
        title: shouldReplaceTitle ? nextAutoTitle : prev.title,
      };
    });
  };

  const handleClose = () => {
    onClose();
  };



  // ── Return ViewModel ────────────────────────────────────────────────────

  return {
    form,
    errors: externalErrors,
    showFacilityGuide,

    selectedUser,
    selectedStaffOption,
    selectedOrgOption,
    titleLabel,
    primaryButtonLabel,
    titlePlaceholder,
    titleHelperText,
    isOrgCategory,
    dateOrderErrorMessage,
    serviceTypeErrorMessage,
    autoTitleFromForm,

    titleInputRef,
    userInputRef,
    staffInputRef,

    handleUserChange,
    handleFieldChange,
    handleCategoryChange,
    handleStaffChange,
    handleClose,

    headingId,
    descriptionId,
    dialogAriaDescribedBy,
    resolvedDialogTestId,
    errorSummaryId,

    staffOptions,
    orgOptions,

    openAnnouncement,
  };
}
