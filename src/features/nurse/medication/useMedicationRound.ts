/**
 * useMedicationRound.ts — State and business logic hook for MedicationRound.
 *
 * Encapsulates all useState / useMemo that previously lived inline in
 * MedicationRound.tsx, leaving the component as a thin presentation shell.
 */
import { NURSE_USERS } from '@/features/nurse/users';
import { toLocalDateISO } from '@/utils/getNow';
import { useMemo, useState } from 'react';
import {
    createDefaultInventoryByUser,
    filterInventory,
    mergeInventory,
    summarizeInventory,
    type StatusFilter,
} from './medicationRoundHelpers';
import type { MedicationInventoryEntry, MedicationSeed } from './medicationRoundTypes';

export type { StatusFilter };
export type MedicationFormState = Omit<MedicationInventoryEntry, 'id'>;

const FORM_DEFAULTS: MedicationFormState = {
  category: '予備薬',
  name: '',
  dosage: '',
  stock: 0,
  unit: '錠',
  expirationDate: toLocalDateISO(),
  prescribedBy: '',
  storage: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useMedicationRound = () => {
  // ── seed (injected by E2E / test runner via window.__NURSE_MEDS_SEED__) ──
  const medicationSeed = useMemo<MedicationSeed | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return window.__NURSE_MEDS_SEED__;
  }, []);

  const nurseUsers = useMemo(() => {
    if (medicationSeed?.users?.length) return medicationSeed.users;
    return NURSE_USERS;
  }, [medicationSeed]);

  const defaultInventory = useMemo(
    () => createDefaultInventoryByUser(nurseUsers),
    [nurseUsers],
  );

  const initialInventory = useMemo(
    () => mergeInventory(defaultInventory, medicationSeed?.inventory),
    [defaultInventory, medicationSeed],
  );

  // ── UI state ──
  const [inventoryByUser, setInventoryByUser] =
    useState<Record<string, MedicationInventoryEntry[]>>(() => initialInventory);
  const [selectedUser, setSelectedUser] = useState(nurseUsers[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<MedicationFormState>(FORM_DEFAULTS);
  const [toast, setToast] = useState<string | null>(null);

  // ── derived ──
  const inventory = useMemo<MedicationInventoryEntry[]>(
    () => inventoryByUser[selectedUser] ?? [],
    [inventoryByUser, selectedUser],
  );

  const selectedUserInfo = useMemo(
    () => nurseUsers.find((u) => u.id === selectedUser),
    [nurseUsers, selectedUser],
  );
  const selectedUserName = selectedUserInfo?.name ?? '対象者未選択';

  const summary = useMemo(() => summarizeInventory(inventory), [inventory]);

  const filteredInventory = useMemo(
    () => filterInventory(inventory, statusFilter, search),
    [inventory, statusFilter, search],
  );

  // ── actions ──
  const resetForm = () => setForm({ ...FORM_DEFAULTS, expirationDate: toLocalDateISO() });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) {
      setToast('利用者を選択してください');
      return;
    }
    const nextId = Math.max(0, ...inventory.map((item) => item.id)) + 1;
    setInventoryByUser((prev) => {
      const current = prev[selectedUser] ?? [];
      return { ...prev, [selectedUser]: [...current, { id: nextId, ...form }] };
    });
    setDialogOpen(false);
    resetForm();
    const msg = selectedUserName === '対象者未選択'
      ? '在庫を登録しました'
      : `${selectedUserName} さんの在庫を登録しました`;
    setToast(msg);
  };

  return {
    // data
    nurseUsers,
    inventory,
    filteredInventory,
    summary,
    selectedUser,
    selectedUserInfo,
    selectedUserName,
    // filter state
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    // dialog state
    dialogOpen,
    setDialogOpen,
    form,
    setForm,
    // actions
    handleSubmit,
    resetForm,
    setSelectedUser,
    // toast
    toast,
    setToast,
  };
};
