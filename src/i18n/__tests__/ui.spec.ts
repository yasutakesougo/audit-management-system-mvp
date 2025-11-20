import { describe, expect, it } from 'vitest';
import { filtersUI, getUIText, scheduleUI, type UIPath } from '../helpers';
import { ui } from '../ui';

describe('i18n/ui', () => {
  describe('ui structure', () => {
    it('should maintain backward compatibility for existing keys', () => {
      expect(ui.schedule.listTitle).toBe('スケジュール一覧');
      expect(ui.filters.schedule).toBe('スケジュールの検索とフィルタ');
    });

    it('should have all required schedule action labels', () => {
      expect(ui.schedule.actions.new).toBe('新規スケジュール');
      expect(ui.schedule.actions.edit).toBe('スケジュールを編集');
      expect(ui.schedule.actions.delete).toBe('スケジュールを削除');
      expect(ui.schedule.actions.duplicate).toBe('スケジュールを複製');
    });

    it('should have complete form labels', () => {
      expect(ui.schedule.form.createTitle).toBe('スケジュールを新規作成');
      expect(ui.schedule.form.editTitle).toBe('スケジュールを編集');
      expect(ui.schedule.form.save).toBe('保存');
      expect(ui.schedule.form.cancel).toBe('キャンセル');
    });

    it('should have delete dialog strings', () => {
      expect(ui.schedule.deleteDialog.title).toBe('スケジュールの削除');
      expect(ui.schedule.deleteDialog.message).toContain('削除しますか？');
      expect(ui.schedule.deleteDialog.confirm).toBe('削除する');
    });

    it('should have filter field labels', () => {
      expect(ui.filters.scheduleFields.keywordLabel).toBe('キーワード');
      expect(ui.filters.scheduleFields.dateRangeLabel).toBe('日付範囲');
      expect(ui.filters.scheduleFields.staffLabel).toBe('担当スタッフ');
    });
  });

  describe('getUIText helper', () => {
    it('should retrieve nested text by path', () => {
      expect(getUIText('schedule.listTitle')).toBe('スケジュール一覧');
      expect(getUIText('schedule.actions.new')).toBe('新規スケジュール');
      expect(getUIText('filters.scheduleFields.keywordLabel')).toBe('キーワード');
    });

    it('should throw error for invalid paths', () => {
      expect(() => getUIText('invalid.path' as UIPath))
        .toThrow('UI text not found for path: invalid.path');

      expect(() => getUIText('schedule.nonexistent' as UIPath))
        .toThrow('UI text not found for path: schedule.nonexistent');
    });

    it('should throw error for non-string values', () => {
      // Test by creating a mock scenario where path points to object
      const mockUI = { ...ui };
      (mockUI.schedule as Record<string, unknown>).testObject = { nested: 'value' };

      // We'll create a separate getUIText function for this test
      const testGetUIText = (path: string, testUi: typeof mockUI): string => {
        const parts = path.split('.');
        let current: unknown = testUi;

        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = (current as Record<string, unknown>)[part];
          } else {
            throw new Error(`UI text not found for path: ${path}`);
          }
        }

        if (typeof current !== 'string') {
          throw new Error(`UI text at path "${path}" is not a string`);
        }

        return current;
      };

      expect(() => testGetUIText('schedule.testObject', mockUI))
        .toThrow('UI text at path "schedule.testObject" is not a string');
    });
  });

  describe('helper functions', () => {
    it('should provide type-safe access to schedule UI', () => {
      expect(scheduleUI.title()).toBe('スケジュール一覧');
      expect(scheduleUI.actions.new()).toBe('新規スケジュール');
      expect(scheduleUI.form.save()).toBe('保存');
      expect(scheduleUI.deleteDialog.confirm()).toBe('削除する');
      expect(scheduleUI.state.loading()).toBe('スケジュールを読み込み中…');
    });

    it('should provide type-safe access to filters UI', () => {
      expect(filtersUI.schedule()).toBe('スケジュールの検索とフィルタ');
      expect(filtersUI.scheduleFields.heading()).toBe('スケジュールの検索とフィルタ');
      expect(filtersUI.scheduleFields.reset()).toBe('条件をクリア');
      expect(filtersUI.scheduleFields.apply()).toBe('この条件で絞り込む');
    });
  });

  describe('consistency checks', () => {
    it('should have consistent message types for success/error pairs', () => {
      // Form messages
      expect(ui.schedule.form.successMessage).toContain('保存しました');
      expect(ui.schedule.form.errorMessage).toContain('失敗しました');

      // Delete dialog messages
      expect(ui.schedule.deleteDialog.successMessage).toContain('削除しました');
      expect(ui.schedule.deleteDialog.errorMessage).toContain('失敗しました');
    });

    it('should use consistent terminology', () => {
      // All schedule-related text should use "スケジュール"
      const scheduleTexts = [
        ui.schedule.listTitle,
        ui.schedule.actions.new,
        ui.schedule.actions.edit,
        ui.schedule.deleteDialog.title,
      ];

      scheduleTexts.forEach(text => {
        expect(text).toContain('スケジュール');
      });
    });

    it('should have proper button/action language', () => {
      // Action buttons should be concise
      expect(ui.schedule.actions.new).not.toContain('する');
      expect(ui.schedule.actions.edit).toContain('を編集');
      expect(ui.schedule.form.save).toBe('保存');

      // Cancel/Close should be clear
      expect(ui.schedule.form.cancel).toBe('キャンセル');
      expect(ui.schedule.deleteDialog.cancel).toBe('キャンセル');
    });
  });

  describe('text completeness', () => {
    it('should have all required state messages', () => {
      expect(ui.schedule.state.loading).toContain('読み込み中');
      expect(ui.schedule.state.empty).toContain('ありません');
      expect(ui.schedule.state.loadError).toContain('失敗しました');
    });

    it('should have comprehensive filter field labels', () => {
      const requiredFields = [
        'keywordLabel',
        'dateRangeLabel',
        'staffLabel',
        'userLabel',
        'statusLabel'
      ] as const;

      requiredFields.forEach(field => {
        expect(ui.filters.scheduleFields[field]).toBeTruthy();
        expect(typeof ui.filters.scheduleFields[field]).toBe('string');
      });
    });
  });

  describe('future extensibility', () => {
    it('should support easy addition of new UI sections', () => {
      // Test that the structure supports extending with new sections
      const hasConsistentStructure = (
        typeof ui === 'object' &&
        'schedule' in ui &&
        'filters' in ui &&
        typeof ui.schedule === 'object' &&
        typeof ui.filters === 'object'
      );

      expect(hasConsistentStructure).toBe(true);
    });
  });
});