import type { NavItem } from '@/app/types';

/** ナビ配列のリテラル/タプル型を保ったまま返すヘルパ */
export function defineNav<T extends readonly NavItem[]>(items: T): T {
  return items;
}
