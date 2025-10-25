// src/app/types.ts

// React 型は通常の import で参照（ESLint/TS パーサ安全性向上）
import { ElementType } from 'react';

// TESTIDS を単一ソースから参照（import 文で安定化）
import { TESTIDS } from '@/testids';
export type TestId = keyof typeof TESTIDS;

// 役割（RBAC）
export type Role = 'admin' | 'staff' | 'viewer';

// XOR: A か B のどちらか一方のみ許可

// Base フィールド（readonly）
type NavBase = Readonly<{
  label: string;
  icon?: ElementType;
  roles?: readonly Role[];
  testid?: TestId;
  exact?: boolean;
  hidden?: boolean;
  children?: readonly NavItem[];
}>;

// to / href は排他（Unionで緩和）
type NavTo = Readonly<{ to: string; href?: never }>;
type NavHref = Readonly<{ href: string; to?: never }>;

export type NavItem = (NavTo | NavHref) & NavBase;
