import { useMemo } from 'react';

import { useStaffStore } from '@/features/staff/store';

export type StaffOption = {
  id: number;
  label: string;
};

const formatLabel = (params: { name?: string; staffCode?: string; jobTitle?: string }, fallbackId: number): string => {
  const name = params.name?.trim() ?? '';
  const code = params.staffCode?.trim() ?? '';
  const jobTitle = params.jobTitle?.trim() ?? '';

  if (name && code && jobTitle) {
    return `${name}（${jobTitle} / ${code}）`;
  }
  if (name && jobTitle) {
    return `${name}（${jobTitle}）`;
  }
  if (name && code) {
    return `${name}（${code}）`;
  }
  if (name) {
    return name;
  }
  if (code) {
    return code;
  }
  return `職員 ${fallbackId}`;
};

export const useStaffOptions = (): StaffOption[] => {
  const { data: staffRows } = useStaffStore();

  return useMemo(() => {
    if (!Array.isArray(staffRows)) {
      return [];
    }

    return staffRows
      .map((staff) => {
        if (!staff) return null;
        const numericId = typeof staff.id === 'number' ? staff.id : Number(staff.id);
        if (!Number.isFinite(numericId)) {
          return null;
        }

        const label = formatLabel(
          {
            name: staff.name,
            staffCode: staff.staffId,
            jobTitle: staff.jobTitle ?? staff.role,
          },
          numericId,
        );

        return { id: numericId, label } satisfies StaffOption;
      })
      .filter((option): option is StaffOption => Boolean(option));
  }, [staffRows]);
};
