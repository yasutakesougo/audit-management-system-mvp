import { readEnv } from '@/lib/env';

export const NURSE_LISTS = {
  observation: readEnv('VITE_SP_LIST_NURSE_OBSERVATION', 'Nurse_Observation'),
} as const;

type NurseListKey = keyof typeof NURSE_LISTS;

export type NurseListTitle = (typeof NURSE_LISTS)[NurseListKey];
