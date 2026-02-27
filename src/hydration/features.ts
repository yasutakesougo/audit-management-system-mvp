import type { HydrationSpan } from '../lib/hydrationHud';
import { beginHydrationSpan } from '../lib/hydrationHud';

export type HydrationFeatureEntry = {
  id: HydrationSpan['id'];
  label: HydrationSpan['label'];
  budget: number;
  description?: string;
};

export interface HydrationFeatureTree {
  [key: string]: HydrationFeatureEntry | HydrationFeatureTree;
}

export const HYDRATION_FEATURES = {
  supportPlanGuide: {
    markdown: {
      id: 'feature:support-plan-guide:markdown',
      label: 'Support Plan Markdown render',
      budget: 90,
      description: 'Markdown preview lazy import + render pipeline',
    },
    draftLoad: {
      id: 'feature:support-plan-guide:drafts-load',
      label: 'Support Plan draft bootstrap',
      budget: 70,
      description: 'localStorage read + sanitize path for drafts',
    },
  },
  integratedResourceCalendar: {
    events: {
      id: 'feature:integrated-resource-calendar:events',
      label: 'IRC unified event load',
      budget: 160,
      description: 'SharePoint client fetch + normalization',
    },
    warnings: {
      id: 'feature:integrated-resource-calendar:warnings',
      label: 'IRC resource warning scan',
      budget: 60,
      description: 'Per-resource total hours calculation + warning flags',
    },
  },
  dashboard: {
    activityModel: {
      id: 'feature:dashboard:activity-model',
      label: 'Dashboard activity simulation',
      budget: 80,
      description: 'Mock diary generation per user (Plan vs Actual)',
    },
    usageAggregation: {
      id: 'feature:dashboard:usage-aggregation',
      label: 'Dashboard usage aggregation',
      budget: 90,
      description: 'Monthly usage map derived from diary records',
    },
  },
  meeting: {
    load: {
      id: 'feature:meeting:load',
      label: 'Meeting session bootstrap',
      budget: 140,
      description: 'SharePoint session + steps fetch with memoization',
    },
    derive: {
      id: 'feature:meeting:derive',
      label: 'Meeting view derivation',
      budget: 60,
      description: 'Template + SharePoint record merge for guide UI',
    },
    drawer: {
      id: 'feature:meeting:drawer',
      label: 'Meeting drawer open',
      budget: 25,
      description: 'Drawer open interaction + HUD sync',
    },
  },
  schedules: {
    load: {
      id: 'feature:schedules:load',
      label: 'Schedules data load',
      budget: 170,
      description: 'User + org + staff SharePoint fetch pipeline',
    },
    write: {
      id: 'feature:schedules:write',
      label: 'Schedules write pipeline',
      budget: 110,
      description: 'SharePoint batch save with optimistic updates',
    },
    move: {
      id: 'feature:schedules:move',
      label: 'Schedule move operation',
      budget: 45,
      description: 'Pure move transform + validation',
    },
    range: {
      id: 'feature:schedules:range',
      label: 'Schedule range rebuild',
      budget: 55,
      description: 'Week/month boundary recomputation',
    },
    conflict: {
      id: 'feature:schedules:conflict',
      label: 'Schedule conflict detection',
      budget: 75,
      description: 'Collision + overlap scan across resources',
    },
    recompute: {
      id: 'feature:schedules:recompute',
      label: 'Schedule UI recompute',
      budget: 120,
      description: 'Week/month slot virtualization + memo builds',
    },
  },
  daily: {
    load: {
      id: 'feature:daily:load',
      label: 'Daily record load',
      budget: 80,
      description: 'SharePoint single-day record fetch + Zod validation',
    },
    save: {
      id: 'feature:daily:save',
      label: 'Daily record save',
      budget: 120,
      description: 'SharePoint daily record upsert (find existing + create/update)',
    },
    list: {
      id: 'feature:daily:list',
      label: 'Daily records list',
      budget: 150,
      description: 'SharePoint date-range query + batch Zod validation',
    },
  },
} as const satisfies HydrationFeatureTree;

// だいたいのペイロードサイズを文字数ベースで推定（HUD用メタ）
export const estimatePayloadSize = (payload: unknown): number | undefined => {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return undefined;
  }
};

type FlattenHydrationFeatureEntries<T> = T extends HydrationFeatureEntry
  ? T
  : T extends Record<string, unknown>
    ? {
        [K in keyof T]: FlattenHydrationFeatureEntries<T[K]>;
      }[keyof T]
    : never;

type HydrationFeatureEntries = FlattenHydrationFeatureEntries<typeof HYDRATION_FEATURES>;

export type HydrationFeatureId = HydrationFeatureEntries['id'];

const isHydrationFeatureEntry = (value: unknown): value is HydrationFeatureEntry => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'id' in value && 'label' in value && 'budget' in value;
};

const collectHydrationFeatures = (node: HydrationFeatureTree): HydrationFeatureEntry[] => {
  return Object.values(node).flatMap((value) => (
    isHydrationFeatureEntry(value)
      ? [value]
      : collectHydrationFeatures(value)
  ));
};

export const listHydrationFeatureEntries = (): HydrationFeatureEntry[] => collectHydrationFeatures(HYDRATION_FEATURES);

export const startFeatureSpan = (
  entry: HydrationFeatureEntry,
  meta?: Record<string, unknown>,
): ReturnType<typeof beginHydrationSpan> => beginHydrationSpan(entry.id, {
  id: entry.id,
  label: entry.label,
  group: 'hydration:feature',
  meta: {
    budget: entry.budget,
    ...meta,
  },
});
