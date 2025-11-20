/**
 * Progress Logic Unit Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
    aggregateTeamProgress,
    calculateDailyProgress,
    calculateHandoffStatus,
    calculateProgress,
    getProgressColor,
    getProgressStatusText,
    sortHandoffsByUrgency,
    type DailyProgressSummary,
    type HandoffItem,
    type TaskProgress
} from '../progressLogic';

describe('Progress Logic', () => {
  let mockHandoff: HandoffItem;

  beforeEach(() => {
    mockHandoff = {
      id: 'handoff-1',
      title: 'Test Handoff',
      assignee: 'John Doe',
      dueDate: new Date('2024-01-15 17:00:00'),
      status: 'pending',
      priority: 'medium'
    };
  });

  describe('calculateProgress', () => {
    it('should calculate correct percentage', () => {
      const result = calculateProgress(75, 100);
      expect(result.completed).toBe(75);
      expect(result.total).toBe(100);
      expect(result.percentage).toBe(75);
    });

    it('should handle zero division', () => {
      const result = calculateProgress(5, 0);
      expect(result.total).toBe(1);
      expect(result.percentage).toBe(100); // 5/1 * 100, capped at 100
    });

    it('should handle negative values', () => {
      const result = calculateProgress(-5, 10);
      expect(result.completed).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('should cap percentage at 100', () => {
      const result = calculateProgress(150, 100);
      expect(result.percentage).toBe(100);
    });
  });

  describe('aggregateTeamProgress', () => {
    it('should aggregate attendance and task progress', () => {
      const attendanceData = { present: 8, total: 10 };
      const taskData = { completed: 15, total: 20 };

      const result = aggregateTeamProgress(attendanceData, taskData);

      expect(result.teamName).toBe('チーム全体');
      expect(result.attendance.percentage).toBe(80);
      expect(result.tasks.percentage).toBe(75);
      expect(result.overall.completed).toBe(23); // 8 + 15
      expect(result.overall.total).toBe(30); // 10 + 20
    });
  });

  describe('calculateHandoffStatus', () => {
    it('should mark overdue items as overdue', () => {
      const overdueHandoff = {
        ...mockHandoff,
        dueDate: new Date(Date.now() - 86400000), // Yesterday (24 hours ago)
        status: 'pending' as const
      };

      const result = calculateHandoffStatus(overdueHandoff);
      expect(result.status).toBe('overdue');
    });

    it('should keep completed items as completed', () => {
      const completedHandoff = {
        ...mockHandoff,
        dueDate: new Date(Date.now() - 86400000), // Yesterday but completed
        status: 'completed' as const
      };

      const result = calculateHandoffStatus(completedHandoff);
      expect(result.status).toBe('completed');
    });

    it('should not change status for future due dates', () => {
      const futureHandoff = {
        ...mockHandoff,
        dueDate: new Date(Date.now() + 86400000), // Tomorrow (24 hours from now)
        status: 'pending' as const
      };

      const result = calculateHandoffStatus(futureHandoff);
      expect(result.status).toBe('pending');
    });
  });

  describe('sortHandoffsByUrgency', () => {
    it('should sort by status priority', () => {
      const now = Date.now();
      const handoffs: HandoffItem[] = [
        { ...mockHandoff, id: '1', status: 'completed', priority: 'high', dueDate: new Date(now + 86400000) },
        { ...mockHandoff, id: '2', status: 'pending', priority: 'low', dueDate: new Date(now - 86400000) }, // This will become overdue
        { ...mockHandoff, id: '3', status: 'in-progress', priority: 'medium', dueDate: new Date(now + 86400000) },
        { ...mockHandoff, id: '4', status: 'pending', priority: 'high', dueDate: new Date(now + 86400000) }
      ];

      const sorted = sortHandoffsByUrgency(handoffs);

      expect(sorted[0].id).toBe('2'); // overdue (was pending but past due)
      expect(sorted[1].id).toBe('3'); // in-progress
      expect(sorted[2].id).toBe('4'); // pending with future due date
      expect(sorted[3].id).toBe('1'); // completed
    });

    it('should sort by priority within same status', () => {
      const handoffs: HandoffItem[] = [
        { ...mockHandoff, id: '1', status: 'pending', priority: 'low' },
        { ...mockHandoff, id: '2', status: 'pending', priority: 'high' },
        { ...mockHandoff, id: '3', status: 'pending', priority: 'medium' }
      ];

      const sorted = sortHandoffsByUrgency(handoffs);

      expect(sorted[0].priority).toBe('high');
      expect(sorted[1].priority).toBe('medium');
      expect(sorted[2].priority).toBe('low');
    });

    it('should sort by due date within same status and priority', () => {
      const handoffs: HandoffItem[] = [
        {
          ...mockHandoff,
          id: '1',
          status: 'pending',
          priority: 'high',
          dueDate: new Date('2024-01-16 17:00:00')
        },
        {
          ...mockHandoff,
          id: '2',
          status: 'pending',
          priority: 'high',
          dueDate: new Date('2024-01-15 17:00:00')
        }
      ];

      const sorted = sortHandoffsByUrgency(handoffs);

      expect(sorted[0].id).toBe('2'); // Earlier due date first
      expect(sorted[1].id).toBe('1');
    });
  });

  describe('getProgressColor', () => {
    it('should return correct colors for progress ranges', () => {
      expect(getProgressColor(95)).toBe('success.main');
      expect(getProgressColor(80)).toBe('info.main');
      expect(getProgressColor(60)).toBe('warning.main');
      expect(getProgressColor(30)).toBe('error.main');
    });

    it('should handle edge cases', () => {
      expect(getProgressColor(90)).toBe('success.main');
      expect(getProgressColor(75)).toBe('info.main');
      expect(getProgressColor(50)).toBe('warning.main');
      expect(getProgressColor(0)).toBe('error.main');
    });
  });

  describe('getProgressStatusText', () => {
    it('should return correct status text for different progress levels', () => {
      const progress100: TaskProgress = { completed: 10, total: 10, percentage: 100 };
      const progress80: TaskProgress = { completed: 8, total: 10, percentage: 80 };
      const progress60: TaskProgress = { completed: 6, total: 10, percentage: 60 };
      const progress30: TaskProgress = { completed: 3, total: 10, percentage: 30 };

      expect(getProgressStatusText(progress100)).toContain('✅ 完了');
      expect(getProgressStatusText(progress80)).toContain('🎯 順調');
      expect(getProgressStatusText(progress60)).toContain('⚠️ 注意');
      expect(getProgressStatusText(progress30)).toContain('🚨 要確認');
    });

    it('should include correct counts in status text', () => {
      const progress: TaskProgress = { completed: 7, total: 10, percentage: 70 };
      const statusText = getProgressStatusText(progress);

      expect(statusText).toContain('(7/10)');
      expect(statusText).toContain('70%');
    });
  });

  describe('calculateDailyProgress', () => {
    it('should calculate overall score with weighted average', () => {
      const taskProgress: TaskProgress = { completed: 8, total: 10, percentage: 80 };
      const attendanceProgress: TaskProgress = { completed: 9, total: 10, percentage: 90 };

      const result = calculateDailyProgress(taskProgress, attendanceProgress);

      // Expected: (80 * 0.6) + (90 * 0.4) = 48 + 36 = 84
      expect(result.overallScore).toBe(84);
      expect(result.totalTasks).toBe(10);
      expect(result.completedTasks).toBe(8);
      expect(result.attendanceRate).toBe(90);
    });

    it('should calculate trending correctly', () => {
      const taskProgress: TaskProgress = { completed: 8, total: 10, percentage: 80 };
      const attendanceProgress: TaskProgress = { completed: 9, total: 10, percentage: 90 };

      const previousDay: DailyProgressSummary = {
        date: '2024-01-14',
        totalTasks: 10,
        completedTasks: 6,
        attendanceRate: 80,
        overallScore: 70,
        trending: 'stable'
      };

      const result = calculateDailyProgress(taskProgress, attendanceProgress, previousDay);

      expect(result.trending).toBe('up'); // 84 - 70 = 14, which is > 5
    });

    it('should default to stable trending without previous day', () => {
      const taskProgress: TaskProgress = { completed: 8, total: 10, percentage: 80 };
      const attendanceProgress: TaskProgress = { completed: 9, total: 10, percentage: 90 };

      const result = calculateDailyProgress(taskProgress, attendanceProgress);

      expect(result.trending).toBe('stable');
    });
  });
});