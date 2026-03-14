/**
 * weeklyObservationChecker — 純粋関数の単体テスト
 */
import { describe, it, expect } from 'vitest';
import {
  findUsersWithoutRecentObservation,
  type ObservationRecordMinimal,
} from '@/domain/regulatory/weeklyObservationChecker';

const makeObs = (userId: string, observationDate: string): ObservationRecordMinimal => ({
  userId,
  observationDate,
});

describe('findUsersWithoutRecentObservation', () => {

  const TODAY = '2026-03-14';

  it('対象者が空の場合、空を返す', () => {
    const result = findUsersWithoutRecentObservation([], [], TODAY);
    expect(result).toEqual([]);
  });

  it('直近30日以内に観察がある利用者は不足なし', () => {
    const observations = [
      makeObs('U001', '2026-03-10'),
      makeObs('U002', '2026-03-01'),
    ];
    const result = findUsersWithoutRecentObservation(
      ['U001', 'U002'],
      observations,
      TODAY,
    );
    expect(result).toEqual([]);
  });

  it('直近30日以内に観察がない利用者を検出する', () => {
    const observations = [
      makeObs('U001', '2026-03-10'),
      makeObs('U002', '2026-01-01'),  // 30日以上前
    ];
    const result = findUsersWithoutRecentObservation(
      ['U001', 'U002'],
      observations,
      TODAY,
    );
    expect(result).toEqual(['U002']);
  });

  it('観察記録が全くない利用者を検出する', () => {
    const result = findUsersWithoutRecentObservation(
      ['U001', 'U002'],
      [],
      TODAY,
    );
    expect(result).toEqual(['U001', 'U002']);
  });

  it('対象外の利用者の観察は無視する', () => {
    const observations = [
      makeObs('U099', '2026-03-10'),  // 対象外
    ];
    const result = findUsersWithoutRecentObservation(
      ['U001'],
      observations,
      TODAY,
    );
    expect(result).toEqual(['U001']);
  });

  it('lookbackDays をカスタマイズできる', () => {
    const observations = [
      makeObs('U001', '2026-03-07'),  // 7日前 → lookback=5 だと範囲外
    ];
    const result = findUsersWithoutRecentObservation(
      ['U001'],
      observations,
      TODAY,
      5,
    );
    expect(result).toEqual(['U001']);
  });

  it('境界値: ちょうど30日前の観察は不足なし', () => {
    const observations = [
      makeObs('U001', '2026-02-12'),  // ちょうど30日前
    ];
    const result = findUsersWithoutRecentObservation(
      ['U001'],
      observations,
      TODAY,
      30,
    );
    expect(result).toEqual([]);
  });
});
