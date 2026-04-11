import type { Role } from '@/auth/roles';

export type HubId =
  | 'today'
  | 'records'
  | 'planning'
  | 'operations'
  | 'billing'
  | 'master'
  | 'platform'
  | 'severe';

export type HubEntryStatus = 'primary' | 'secondary' | 'comingSoon';

export type HubEntryCard = {
  id: string;
  title: string;
  description: string;
  to?: string;
  requiredRole?: Role;
  status?: HubEntryStatus;
  kpiWeight?: number;
  usagePriority?: number;
  rolePriority?: Partial<Record<Role, number>>;
  priority?: number;
  ctaLabel?: string;
  helpLink?: string;
  badge?: string;
};

export type HubDefinition = {
  id: HubId;
  title: string;
  subtitle: string;
  purpose: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  primaryCtaLabel: string;
  telemetryName: string;
  helpLink?: string;
  requiredRole?: Role;
  standaloneRoute?: boolean;
  pageTitle: string;
  breadcrumbLabel: string;
  analyticsName: string;
  rootPath: string;
  activePathPrefixes?: string[];
  inactivePathPrefixes?: string[];
  navLabel?: string;
  showComingSoonEntries?: boolean;
  primaryEntries: HubEntryCard[];
  secondaryEntries?: HubEntryCard[];
};
