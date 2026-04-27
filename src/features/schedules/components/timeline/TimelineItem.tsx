import { SCHEDULE_TIMELINE_SPACING } from '../../constants';
import type { ScheduleStatus } from '../../data';
import { getScheduleStatusMeta } from '../../statusMetadata';

export type TimelineItemProps = {
  title: string;
  timeLabel: string;
  secondary?: string;
  status?: ScheduleStatus;
  statusReason?: string | null;
  acceptedBy?: string | null;
  acceptedOn?: string | null;
  acceptedNote?: string | null;
  hasWarning?: boolean;
  warningLabel?: string;
  compact?: boolean;
  onClick?: () => void;
};

export function TimelineItem({
  title,
  timeLabel,
  secondary,
  status,
  statusReason,
  acceptedBy,
  acceptedOn,
  acceptedNote,
  hasWarning,
  warningLabel,
  compact,
  onClick,
}: TimelineItemProps) {
  const statusMeta = getScheduleStatusMeta(status);
  const dotColor = statusMeta?.dotColor ?? 'rgba(25,118,210,0.9)';
  const badgeLabel = status && status !== 'Planned' ? statusMeta?.label : undefined;
  const opacity = statusMeta?.opacity ?? 1;
  const reason = statusReason?.trim();
  const warningActive = Boolean(hasWarning);
  const warningText = warningLabel ?? '注意が必要な予定です';
  const hasAcceptance = Boolean(acceptedBy || acceptedOn || acceptedNote);
  const acceptedLabel = (() => {
    if (!hasAcceptance) return '';
    const dateText = (() => {
      if (!acceptedOn) return '';
      const date = new Date(acceptedOn);
      if (Number.isNaN(date.getTime())) return acceptedOn.slice(0, 16);
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    })();

    if (!acceptedBy && !dateText) return '';
    if (acceptedBy && dateText) return `受け入れ: ${acceptedBy} / ${dateText}`;
    if (acceptedBy) return `受け入れ: ${acceptedBy}`;
    return `受け入れ: ${dateText}`;
  })();

  const isCompact = Boolean(compact);
  const labelFontSize = isCompact ? 13 : 14;
  const metaFontSize = isCompact ? 11 : 12;
  const acceptFontSize = isCompact ? 10 : 11;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: isCompact ? '68px minmax(0, 1fr)' : '80px minmax(0, 1fr)',
        columnGap: isCompact ? SCHEDULE_TIMELINE_SPACING.itemGridGapCompact : SCHEDULE_TIMELINE_SPACING.itemGridGapNormal,
        alignItems: 'flex-start',
        opacity,
        cursor: onClick ? 'pointer' : 'default',
        padding: '4px 0',
        borderRadius: 8,
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div
        style={{
          fontSize: isCompact ? 11 : 12,
          fontWeight: 600,
          color: 'rgba(0,0,0,0.65)',
          textAlign: 'right',
          paddingTop: isCompact ? 2 : 4,
        }}
      >
        {timeLabel}
      </div>

      <div
        style={{
          position: 'relative',
          paddingLeft: isCompact ? 14 : 18,
          paddingBottom: isCompact ? 6 : 8,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 7,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.06))',
          }}
        />
        {warningActive ? (
          <div
            data-testid="schedule-warning-indicator"
            title={warningText}
            style={{
              position: 'absolute',
              top: isCompact ? -2 : -4,
              right: 0,
              padding: isCompact ? '1px 4px' : '2px 6px',
              borderRadius: 999,
              background: '#f57c00',
              color: '#fff',
              fontSize: isCompact ? 10 : 11,
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
            aria-label={warningText}
          >
            ⚠
          </div>
        ) : null}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 2,
            top: 6,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.9)',
          }}
        />
        <div
          style={{
            padding: isCompact ? SCHEDULE_TIMELINE_SPACING.itemPaddingCompact : SCHEDULE_TIMELINE_SPACING.itemPaddingNormal,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.02)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              fontSize: labelFontSize,
              fontWeight: 600,
              marginBottom: secondary || badgeLabel || reason ? (isCompact ? 1 : 2) : 0,
            }}
          >
            {title}
            {badgeLabel && (
              <span
                style={{
                  marginLeft: 8,
                  padding: isCompact ? '1px 4px' : '1px 6px',
                  borderRadius: 999,
                  background: statusMeta?.chipBg ?? 'rgba(0,0,0,0.08)',
                  color: statusMeta?.chipColor ?? 'rgba(0,0,0,0.7)',
                  fontSize: isCompact ? 10 : 11,
                  fontWeight: 600,
                }}
              >
                {badgeLabel}
              </span>
            )}
          </div>
          {(secondary || reason) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: isCompact ? 4 : 6,
                fontSize: metaFontSize,
                color: 'rgba(0,0,0,0.6)',
              }}
            >
              {secondary && <span>{secondary}</span>}
              {reason && <span>{reason}</span>}
            </div>
          )}
          {hasAcceptance ? (
            <div
              style={{
                marginTop: isCompact ? 2 : 4,
                fontSize: acceptFontSize,
                color: 'rgba(0,0,0,0.55)',
              }}
              aria-label="受け入れ情報"
            >
              {acceptedLabel}
            </div>
          ) : (
            <div
              style={{
                marginTop: isCompact ? 2 : 4,
                fontSize: isCompact ? 9 : 10,
                color: 'rgba(0,0,0,0.38)',
                fontStyle: 'italic',
              }}
              aria-label="受け入れ情報（未登録）"
            >
              受け入れ: 未登録
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
