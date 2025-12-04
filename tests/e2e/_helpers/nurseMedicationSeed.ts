import type { Page } from '@playwright/test';
import type { NurseUser } from '../../../src/features/nurse/users';
import { NURSE_USERS } from '../../../src/features/nurse/users';

type MedicationInventoryEntry = {
  id?: number;
  category: string;
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

export const MEDICATION_SEED_USERS: NurseUser[] = NURSE_USERS;

export async function seedMedicationDemoData(page: Page, seed: MedicationSeed = {}): Promise<void> {
  const users = seed.users ?? MEDICATION_SEED_USERS;
  const inventory = seed.inventory;

  await page.addInitScript(
    ({ usersSeed, inventorySeed }) => {
      const scope = window as typeof window & {
        __NURSE_MEDS_SEED__?: MedicationSeed;
      };
      scope.__NURSE_MEDS_SEED__ = {
        users: usersSeed,
        ...(inventorySeed ? { inventory: inventorySeed } : {}),
      };
    },
    { usersSeed: users, inventorySeed: inventory },
  );
}
