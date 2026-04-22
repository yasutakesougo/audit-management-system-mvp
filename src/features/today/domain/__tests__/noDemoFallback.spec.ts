/**
 * noDemoFallback — /today が demo/mock 固定データにフォールバックしないことを保証する回帰テスト
 *
 * 目的:
 *   /today の本番移行で demo fallback を排除した。
 *   将来「見栄えのため」に demo を戻す変更が入っても、このテストで検知する。
 *
 * 検証項目:
 *   1. mockActionSources.ts が存在しないこと（削除済み）
 *   2. useTodayActionQueue が fetchMockActionSources を import しないこと
 *   3. useScheduleLanes (dashboard) が空 lanes を返すこと（ハードコード demo なし）
 *   4. TodayOpsPage が summary.scheduleLanesToday をフォールバックとして使わないこと
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('/today demo fallback regression guard', () => {
  it('mockActionSources.ts は本線から削除済み', () => {
    const mockPath = path.join(
      SRC_ROOT,
      'features/today/domain/repositories/mockActionSources.ts',
    );
    expect(fs.existsSync(mockPath)).toBe(false);
  });

  it('useTodayActionQueue は fetchMockActionSources を import しない', () => {
    const hookPath = path.join(
      SRC_ROOT,
      'features/today/hooks/useTodayActionQueue.ts',
    );
    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content).not.toContain('fetchMockActionSources');
    expect(content).not.toContain('mockActionSources');
  });

  it('useScheduleLanes (dashboard) はハードコード demo lanes を含まない', () => {
    const lanesPath = path.join(
      SRC_ROOT,
      'features/dashboard/selectors/useScheduleLanes.ts',
    );
    const content = fs.readFileSync(lanesPath, 'utf-8');

    // 以前のハードコード demo 文言が含まれていないこと
    const demoStrings = [
      '通所受け入れ',
      '検温・バイタル確認',
      '午前の過ごし記録',
      '昼食量確認',
      '午後の過ごし記録',
      '退所対応',
      '自治体監査ヒアリング',
      '家族向け連絡会資料確認',
      '設備点検結果共有',
      '作業プログラム',
      '個別支援',
      'リハビリ',
    ];
    for (const s of demoStrings) {
      expect(content).not.toContain(s);
    }
  });

  it('TodayOpsPage は summary.scheduleLanesToday をフォールバック先として使わない', () => {
    const pagePath = path.join(SRC_ROOT, 'pages/today-isolated/TodayOpsPage_v3.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    // effectiveLanes の算出に summary.scheduleLanesToday が含まれていないこと
    // (他の用途で参照がある場合は許容するが、effectiveLanes 付近で使われていないことを確認)
    const effectiveLanesBlock = content.slice(
      content.indexOf('effectiveLanes'),
      content.indexOf('effectiveLanes') + 300,
    );
    expect(effectiveLanesBlock).not.toContain('summary.scheduleLanesToday');
  });
});
