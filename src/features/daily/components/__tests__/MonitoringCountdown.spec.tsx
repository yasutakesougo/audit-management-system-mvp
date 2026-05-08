/**
 * MonitoringCountdown.spec.tsx — モニタリング期限カウントダウンのテスト
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonitoringCountdown } from '../MonitoringCountdown';

describe('MonitoringCountdown', () => {
  const userName = 'テスト太郎';

  it('支援開始日が未設定の場合、警告メッセージを表示する', () => {
    render(
      <MonitoringCountdown 
        userName={userName} 
        monitoringBaseDate={null} 
        lastAssessmentDate={null} 
      />
    );
    expect(screen.getByText('支援開始日未設定')).toBeInTheDocument();
  });

  it('支援開始日が設定されている場合、残り日数を表示する', () => {
    // 2026-01-01 開始, 2026-01-11 今日 -> 残り 80日
    const today = new Date('2026-01-11T00:00:00');
    render(
      <MonitoringCountdown 
        userName={userName} 
        monitoringBaseDate="2026-01-01" 
        today={today}
      />
    );
    expect(screen.getByText(/次回モニタリング期限まで 80日/)).toBeInTheDocument();
    // 暫定表示は出ないはず
    expect(screen.queryByText('[暫定]')).not.toBeInTheDocument();
  });

  it('起点日が appliedFrom (fallback) の場合、[暫定] 表示が出る', () => {
    const today = new Date('2026-01-11T00:00:00');
    render(
      <MonitoringCountdown 
        userName={userName} 
        monitoringBaseDate={null} 
        lastAssessmentDate={null}
        appliedFrom="2026-01-01"
        today={today}
      />
    );
    expect(screen.getByText('[暫定]')).toBeInTheDocument();
    expect(screen.getByText(/次回モニタリング期限まで 80日/)).toBeInTheDocument();
  });

  it('不正な日付の場合、エラー表示になる', () => {
    render(
      <MonitoringCountdown 
        userName={userName} 
        monitoringBaseDate="invalid-date" 
      />
    );
    expect(screen.getByText('支援開始日不正')).toBeInTheDocument();
  });
});
