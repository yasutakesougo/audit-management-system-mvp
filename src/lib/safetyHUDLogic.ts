/**
 * Dashboard Safety HUD Logic
 *
 * Controls the Safety Heads-Up Display functionality
 * that provides real-time status monitoring across the dashboard.
 */

export interface SafetyAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface SafetyMetrics {
  activeIssues: number;
  resolvedToday: number;
  averageResponseTime: number; // in minutes
  complianceRate: number; // percentage
}

export interface SafetyHUDState {
  isVisible: boolean;
  alerts: SafetyAlert[];
  metrics: SafetyMetrics;
  lastUpdated: Date;
}

/**
 * Determines if Safety HUD should be visible based on role and conditions
 */
export const shouldShowSafetyHUD = (
  userRole: string | undefined,
  currentMode: string | null,
  hasActiveAlerts: boolean
): boolean => {
  // Always show for safety officers
  if (userRole === 'safety-officer') return true;

  // Show during meetings if there are active alerts
  if ((currentMode === 'morning' || currentMode === 'evening') && hasActiveAlerts) {
    return true;
  }

  // Show for managers during business hours
  if (userRole === 'manager') {
    const currentHour = new Date().getHours();
    return currentHour >= 8 && currentHour <= 18;
  }

  return false;
};

/**
 * Calculates safety priority score for alert ordering
 */
export const calculateSafetyPriority = (alert: SafetyAlert): number => {
  let score = 0;

  // Base severity scoring
  switch (alert.severity) {
    case 'critical': score += 100; break;
    case 'high': score += 70; break;
    case 'medium': score += 40; break;
    case 'low': score += 10; break;
  }

  // Time-based scoring (older alerts get higher priority)
  const hoursOld = (Date.now() - alert.timestamp.getTime()) / (1000 * 60 * 60);
  score += Math.min(hoursOld * 2, 50); // Cap time bonus at 50

  // Unacknowledged alerts get bonus
  if (!alert.acknowledged) {
    score += 25;
  }

  return score;
};

/**
 * Formats safety metrics for display
 */
export const formatSafetyMetrics = (metrics: SafetyMetrics) => {
  return {
    activeIssuesText: `${metrics.activeIssues} 件の課題`,
    resolvedTodayText: `本日解決: ${metrics.resolvedToday} 件`,
    responseTimeText: `平均対応時間: ${Math.round(metrics.averageResponseTime)} 分`,
    complianceText: `コンプライアンス率: ${metrics.complianceRate}%`,
    complianceColor: metrics.complianceRate >= 90 ? 'success.main' :
                    metrics.complianceRate >= 75 ? 'warning.main' : 'error.main'
  };
};

/**
 * Safety HUD visibility toggle logic
 * Handles expanding/collapsing with user preference persistence
 */
export const toggleSafetyHUDVisibility = (
  currentState: boolean,
  userPreference?: string
): { isVisible: boolean; shouldPersist: boolean } => {
  const newState = !currentState;

  // Auto-persist for certain scenarios
  const shouldPersist = userPreference !== 'session-only';

  return { isVisible: newState, shouldPersist };
};

/**
 * Alert acknowledgment logic
 */
export const acknowledgeAlert = (
  alerts: SafetyAlert[],
  alertId: string,
  _userId: string
): SafetyAlert[] => {
  return alerts.map(alert =>
    alert.id === alertId
      ? { ...alert, acknowledged: true }
      : alert
  );
};

/**
 * Safety HUD update frequency calculation
 * Determines refresh interval based on alert severity
 */
export const calculateUpdateFrequency = (alerts: SafetyAlert[]): number => {
  const hasCritical = alerts.some(alert => alert.severity === 'critical');
  const hasHigh = alerts.some(alert => alert.severity === 'high');

  if (hasCritical) return 10000; // 10 seconds for critical
  if (hasHigh) return 30000; // 30 seconds for high
  return 60000; // 1 minute for normal
};

// ========================================
// Dashboard Alert Integration
// ========================================

import type { DashboardAlert } from '../features/dashboard/dashboardSummary.types';

export interface SafetyHUDAlert {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  module: string;
  href?: string;
}

/**
 * Convert Dashboard Alerts to Safety HUD Alert format
 * Prioritizes error > warning > info and limits to top 3 alerts
 */
export const convertDashboardAlertsToSafetyHUD = (
  dashboardAlerts: DashboardAlert[]
): SafetyHUDAlert[] => {
  // Sort by severity priority (error > warning > info)
  const severityOrder = { error: 0, warning: 1, info: 2 };

  const sorted = [...dashboardAlerts].sort((a, b) => {
    const priorityA = severityOrder[a.severity];
    const priorityB = severityOrder[b.severity];
    return priorityA - priorityB;
  });

  // Take top 3 and convert to Safety HUD format
  return sorted.slice(0, 3).map(alert => ({
    id: alert.id,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    module: alert.module,
    href: alert.href
  }));
};

/**
 * Get alert icon based on severity
 */
export const getAlertIcon = (severity: 'error' | 'warning' | 'info'): string => {
  switch (severity) {
    case 'error':
      return '🚨';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '📋';
  }
};

/**
 * Get alert color based on severity
 */
export const getAlertColor = (severity: 'error' | 'warning' | 'info'): string => {
  switch (severity) {
    case 'error':
      return 'error.main';
    case 'warning':
      return 'warning.main';
    case 'info':
      return 'info.main';
    default:
      return 'text.secondary';
  }
};

/**
 * Format alert message for display
 */
export const formatSafetyHUDAlertMessage = (alert: SafetyHUDAlert): string => {
  return alert.message;
};