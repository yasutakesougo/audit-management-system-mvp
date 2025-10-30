import type { ElementType } from 'react';

type MenuSectionKey =
  | 'create-user'
  | 'basic'
  | 'support-plan'
  | 'service-records'
  | 'support-procedure'
  | 'assessment'
  | 'monitoring';

type MenuSectionStatus = 'available' | 'coming-soon';

type MenuSection = {
  key: MenuSectionKey;
  anchor: string;
  title: string;
  description: string;
  icon: ElementType;
  avatarColor: string;
  status: MenuSectionStatus;
  highlights: string[];
  actionLabel?: string;
};

export type { MenuSection, MenuSectionKey, MenuSectionStatus };
