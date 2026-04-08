import { describe, it, expect } from 'vitest';
import { mapExceptionToActionCenterItem } from '../actionCenterMapper';
import type { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';

describe('mapExceptionToActionCenterItem contract', () => {
  it('missing-record (Daily) のマッピング契約を検証する', () => {
    const parent: ExceptionItem = {
      id: 'parent-daily',
      category: 'missing-record',
      title: '日次未入力',
      description: '未入力があります',
      severity: 'high',
      actionPath: '/daily/activity',
      updatedAt: '',
    };
    
    const result = mapExceptionToActionCenterItem(parent, 3);
    
    expect(result).toMatchObject({
      kind: 'daily',
      count: 3,
      unit: '名',
      reasonCode: 'daily_missing',
      actionLabel: '詳細を確認',
    });
    // クエリパラメータの付与確認
    expect(result?.href).toBe('/daily/activity?missing=1');
  });

  it('missing-vital (Vital) のマッピング契約を検証する', () => {
    const parent: ExceptionItem = {
      id: 'parent-vital',
      category: 'missing-vital',
      title: 'バイタル未計測',
      description: 'バイタルが計測されていません',
      severity: 'high',
      actionPath: '/nurse/observation/bulk',
      updatedAt: '',
    };
    
    const result = mapExceptionToActionCenterItem(parent, 5);
    
    expect(result).toMatchObject({
      kind: 'vital',
      count: 5,
      unit: '名',
      reasonCode: 'vital_missing',
    });
    expect(result?.href).toBe('/nurse/observation/bulk?missing=1');
  });

  it('critical-handoff (申し送り) のマッピング契約を検証する', () => {
    const parent: ExceptionItem = {
      id: 'parent-handoff',
      category: 'critical-handoff',
      title: '重要申し送り',
      description: '未読の重要申し送りがあります',
      severity: 'critical',
      actionPath: '/handoff',
      updatedAt: '',
    };
    
    const result = mapExceptionToActionCenterItem(parent, 1);
    
    expect(result).toMatchObject({
      kind: 'handoff',
      priority: 'critical',
      reasonCode: 'handoff_critical',
    });
    expect(result?.href).toBe('/handoff?filter=unread');
  });

  it('transport-alert (送迎) のマッピング契約を検証する', () => {
    const parent: ExceptionItem = {
      id: 'parent-transport',
      category: 'transport-alert',
      title: '送迎遅延',
      description: '遅延が発生しています',
      severity: 'high',
      actionPath: '/daily/transport',
      updatedAt: '',
    };
    
    const result = mapExceptionToActionCenterItem(parent, 2);
    
    expect(result).toMatchObject({
      kind: 'transport',
      count: 2,
      unit: '件',
      reasonCode: 'transport_alert',
    });
    expect(result?.href).toBe('/daily/transport?view=incomplete');
  });

  it('未知のカテゴリは null を返す (Safety)', () => {
    const unknown: any = { category: 'unknown-category' };
    const result = mapExceptionToActionCenterItem(unknown, 1);
    expect(result).toBeNull();
  });
});
