/**
 * Transport Status — Public API
 */

// Types
export type {
    TodayTransportStatus, TransportDirection,
    TransportDirectionSummary,
    TransportLeg,
    TransportLegStatus
} from './transportTypes';

export {
    AUTO_SWITCH_HOUR,
    DIRECTION_EMOJI,
    DIRECTION_LABEL,
    STATUS_COLOR,
    STATUS_LABEL,
    TRANSPORT_TRANSITIONS,
    isTerminalStatus
} from './transportTypes';

// Logic
export type {
    TransportLogEntry,
    TransportUserInfo,
    TransportVisitInfo
} from './transportStatusLogic';

export {
    applyTransition,
    canTransition,
    computeDirectionSummary,
    deriveTransportLegs,
    formatHHmm,
    getDefaultDirection,
    parseHHmmToMinutes
} from './transportStatusLogic';

// Hook
export { useTransportStatus } from './useTransportStatus';
export type { UseTransportStatusReturn } from './useTransportStatus';

// UI Widget
export { TransportStatusCard } from './TransportStatusCard';
export type { TransportStatusCardProps } from './TransportStatusCard';
