import { readEnv } from '@/lib/env';

export const NURSE_LISTS = {
  observation: readEnv('VITE_SP_LIST_NURSE_OBSERVATION', 'NurseObservations'),
} as const;

type NurseListKey = keyof typeof NURSE_LISTS;

export type NurseListTitle = (typeof NURSE_LISTS)[NurseListKey];
