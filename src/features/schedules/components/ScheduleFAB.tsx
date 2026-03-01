import { TESTIDS } from '@/testids';
import type { RefObject } from 'react';

export interface ScheduleFABProps {
  canWrite: boolean;
  onClick: () => void;
  fabRef: RefObject<HTMLButtonElement>;
  resolvedActiveDateIso: string;
  readOnlyMessage?: string;
  fabInset: string;
  fabInsetRight: string;
}

/**
 * ScheduleFAB - Floating Action Button for creating schedules
 *
 * Displays a circular floating button in the bottom-right corner
 * for mobile/tablet views. Disabled when canWrite is false.
 */
export function ScheduleFAB({
  canWrite,
  onClick,
  fabRef,
  resolvedActiveDateIso,
  readOnlyMessage,
  fabInset,
  fabInsetRight,
}: ScheduleFABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={TESTIDS.SCHEDULES_FAB_CREATE}
      ref={fabRef}
      disabled={!canWrite}
      style={{
        position: 'fixed',
        right: fabInsetRight,
        bottom: fabInset,
        width: 64,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        background: canWrite ? '#5B8C5A' : '#ccc',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1,
        cursor: canWrite ? 'pointer' : 'not-allowed',
        zIndex: 1300,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: canWrite ? 1 : 0.6,
      }}
      aria-label={
        !canWrite
          ? readOnlyMessage ?? '現在は閲覧のみです'
          : resolvedActiveDateIso
            ? `選択中の日に予定を追加 (${resolvedActiveDateIso})`
            : '予定を追加'
      }
      title={!canWrite ? readOnlyMessage ?? '現在は閲覧のみです' : undefined}
    >
      <span aria-hidden="true">＋</span>
    </button>
  );
}
