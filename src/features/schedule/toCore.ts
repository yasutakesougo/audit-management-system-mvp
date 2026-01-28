import type { BaseSchedule } from './types';
import type { ScheduleItemCore } from '@/features/schedules/domain';
import { normalizeVisibility } from '@/features/schedules/domain';

export function toCoreFromBaseSchedule(s: BaseSchedule): ScheduleItemCore {
  const raw = s as unknown as Record<string, unknown>;
  const title = String(raw.title ?? raw.subject ?? '');
  const start = String(raw.start ?? raw.Start ?? '');
  const end = String(raw.end ?? raw.End ?? '');
  const id = String(raw.id ?? raw.Id ?? cryptoRandomFallback(`${title}|${start}`));

  return {
    id,
    title,
    start,
    end,
    category: (raw.category as ScheduleItemCore['category']) ?? 'Org',
    visibility: normalizeVisibility(raw.visibility as string | null | undefined),
    location: raw.location as string | undefined,
    notes: raw.notes as string | undefined,
    allDay: raw.allDay as boolean | undefined,
    source: 'sharepoint',
    updatedAt: raw.updatedAt as string | undefined,
    etag: (raw.etag as string | undefined) ?? `"schedule-${id}"`, // Phase 2-0: fallback etag
  };
}

/**
 * deterministic fallback id for migration period (no deps)
 * seed example: `${title}|${start}`
 */
function cryptoRandomFallback(seed?: string) {
  const base = seed ?? 'legacy';
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return `legacy-${Math.abs(h)}`;
}
