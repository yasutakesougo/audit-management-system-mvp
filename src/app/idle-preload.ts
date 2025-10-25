// src/app/idle-preload.ts
import { runOnIdle } from '@/utils/runOnIdle';
import { prefetch } from '@/utils/prefetch';

let scheduled = false;

export function scheduleHomeWarmup(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  runOnIdle(() => {
    prefetch(() => import('@/features/schedule/SchedulePage'), 'route:schedules');
    prefetch(() => import('@/pages/DailyRecordPage'), 'route:records');
  });
}
