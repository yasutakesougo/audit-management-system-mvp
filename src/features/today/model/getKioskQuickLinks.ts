import type { Role } from '@/auth/roles';
import type { FeatureFlagSnapshot } from '@/config/featureFlags';

export type KioskQuickLinkId = 'schedule' | 'handoff' | 'minutes' | 'room' | 'briefing';

export type KioskQuickLink = {
  id: KioskQuickLinkId;
  label: string;
  href: string;
};

type KioskQuickLinkRule = KioskQuickLink & {
  requiredRole?: Role;
  requiredFlag?: keyof FeatureFlagSnapshot;
};

export type GetKioskQuickLinksInput = {
  role: Role;
  flags: FeatureFlagSnapshot;
};

const ALL_KIOSK_QUICK_LINKS: KioskQuickLinkRule[] = [
  {
    id: 'schedule',
    label: 'スケジュール',
    href: '/schedules/week',
    requiredRole: 'viewer',
    requiredFlag: 'schedules',
  },
  {
    id: 'handoff',
    label: '申し送り',
    href: '/handoff-timeline',
    requiredRole: 'viewer',
  },
  {
    id: 'minutes',
    label: '議事録記録',
    href: '/meeting-minutes',
    requiredRole: 'viewer',
  },
  {
    id: 'room',
    label: 'お部屋管理',
    href: '/room-management',
    requiredRole: 'viewer',
  },
  {
    id: 'briefing',
    label: '朝夕会進行',
    href: '/dashboard/briefing',
    requiredRole: 'viewer',
  },
];

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 1,
  reception: 2,
  admin: 3,
};

const canAccess = (role: Role, requiredRole: Role): boolean => ROLE_LEVEL[role] >= ROLE_LEVEL[requiredRole];

export function getKioskQuickLinks(input: GetKioskQuickLinksInput): KioskQuickLink[] {
  const { role, flags } = input;

  return ALL_KIOSK_QUICK_LINKS.filter((link) => {
    if (link.requiredFlag && !flags[link.requiredFlag]) return false;
    if (link.requiredRole && !canAccess(role, link.requiredRole)) return false;
    return true;
  }).map(({ id, label, href }) => ({ id, label, href }));
}

