/**
 * medicationRoundTypes.ts — Domain types and seed data for MedicationRound.
 *
 * Extracted from MedicationRound.tsx to keep type definitions and
 * large constant data separate from UI rendering logic.
 */
import type { NurseUser } from '@/features/nurse/users';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type MedicationInventoryEntry = {
  id: number;
  category: '予備薬' | '頓服' | '定期' | 'その他';
  name: string;
  dosage: string;
  stock: number;
  unit: string;
  expirationDate: string;
  prescribedBy: string;
  storage: string;
  notes?: string;
};

export type MedicationSeed = {
  users?: NurseUser[];
  inventory?: Record<string, MedicationInventoryEntry[]>;
};

// Augment Window for E2E / test seed injection
declare global {
  interface Window {
    __NURSE_MEDS_SEED__?: MedicationSeed;
  }
}

// ---------------------------------------------------------------------------
// Seed data (used as initial client-side state, no network required)
// ---------------------------------------------------------------------------

export const DEFAULT_INVENTORY_SEED: Readonly<Record<string, MedicationInventoryEntry[]>> = Object.freeze({
  I022: [
    {
      id: 1,
      category: '予備薬',
      name: 'セフカペンピボキシル塩酸塩錠 100mg',
      dosage: '発熱時 1回2錠（最大1日3回）',
      stock: 12,
      unit: '錠',
      expirationDate: '2026-02-15',
      prescribedBy: '○○内科クリニック / 佐藤医師',
      storage: '医務室：救急ロッカー 2段目',
      notes: '体温38℃以上で使用。使用後は医師へ報告。',
    },
  ],
  I015: [
    {
      id: 1,
      category: '頓服',
      name: 'ロキソプロフェンナトリウム錠 60mg',
      dosage: '頭痛時 1錠（8時間以上間隔）',
      stock: 8,
      unit: '錠',
      expirationDate: '2025-12-01',
      prescribedBy: '□□病院 ペインクリニック',
      storage: '医務室：頓服トレイ',
      notes: '胃薬（レバミピド）と併用。',
    },
    {
      id: 2,
      category: 'その他',
      name: '消毒用エタノール（500ml）',
      dosage: '創部処置時に使用',
      stock: 1,
      unit: '本',
      expirationDate: '2025-04-30',
      prescribedBy: '施設備蓄',
      storage: '衛生備品棚',
      notes: '開封日：2024-11-01。揮発に注意。',
    },
  ],
});
