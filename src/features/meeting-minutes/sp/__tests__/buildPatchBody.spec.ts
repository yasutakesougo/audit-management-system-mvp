/**
 * Contract Tests: buildPatchBody
 *
 * SharePoint PATCH (MERGE) payload 生成ルールを固定する。
 * meeting-minutes の SP レイヤー（入口: buildFilter / 出口: mapItemToMinutes / 更新: buildPatchBody）
 * の最後のピースとして、書き込み契約を締める。
 *
 * ## 固定する仕様
 *
 * ### undefined の扱い (最重要)
 * - patch フィールドが `undefined` → payload に含めない
 * - patch フィールドが `''` / `false` / `null` → payload に含める
 *
 * ### attendees の特別処理
 * - `attendees` が `undefined` → payload に含めない
 * - `attendees` が配列 → JSON.stringify して保存
 *
 * ### 含めないフィールド（PATCH 対象外）
 * - `id`, `created`, `modified` → UpdateDto に存在しないため payload に含まれない
 *
 * ### key 名
 * - SharePoint Internal Name に対応していること（F.xxx と一致）
 */
import { describe, expect, it } from 'vitest';
import { buildPatchBody } from '../../infra/Legacy/sharepointRepository';
import { MeetingMinutesFields as F } from '../sharepoint';
import type { MeetingMinutesUpdateDto } from '../repository';

describe('buildPatchBody', () => {
  // ── 空の patch ─────────────────────────────────────────────

  describe('空の patch', () => {
    it('should return empty object when patch is empty {}', () => {
      expect(buildPatchBody({})).toEqual({});
    });

    it('should return empty object when all fields are explicitly undefined', () => {
      const patch: MeetingMinutesUpdateDto = {
        title: undefined,
        meetingDate: undefined,
        category: undefined,
        summary: undefined,
        decisions: undefined,
        actions: undefined,
        tags: undefined,
        relatedLinks: undefined,
        isPublished: undefined,
        chair: undefined,
        scribe: undefined,
        attendees: undefined,
        staffAttendance: undefined,
        userHealthNotes: undefined,
      };
      expect(buildPatchBody(patch)).toEqual({});
    });
  });

  // ── undefined は送らない ────────────────────────────────────

  describe('undefined フィールド除外', () => {
    it('should not include title when undefined', () => {
      const result = buildPatchBody({ summary: '変更あり' });
      expect(result).not.toHaveProperty(F.title);
    });

    it('should not include category when undefined', () => {
      const result = buildPatchBody({ title: '変更あり' });
      expect(result).not.toHaveProperty(F.category);
    });

    it('body should only contain keys for defined fields', () => {
      const result = buildPatchBody({ title: '新タイトル', summary: '新サマリー' });
      expect(Object.keys(result)).toEqual([F.title, F.summary]);
    });
  });

  // ── 空文字・false・null は送る ──────────────────────────────

  describe('空文字・false は payload に含める', () => {
    it('should include title when empty string (explicit clear)', () => {
      const result = buildPatchBody({ title: '' });
      expect(result).toHaveProperty(F.title, '');
    });

    it('should include summary when empty string', () => {
      const result = buildPatchBody({ summary: '' });
      expect(result).toHaveProperty(F.summary, '');
    });

    it('should include isPublished when false (unpublish)', () => {
      const result = buildPatchBody({ isPublished: false });
      expect(result).toHaveProperty(F.isPublished, false);
    });

    it('should include tags when empty string (clear tags)', () => {
      const result = buildPatchBody({ tags: '' });
      expect(result).toHaveProperty(F.tags, '');
    });
  });

  // ── 正常系フィールドの key 名 ───────────────────────────────

  describe('key 名が SP Internal Name に対応している', () => {
    it('title → F.title (Title)', () => {
      expect(buildPatchBody({ title: 'A' })).toHaveProperty(F.title, 'A');
    });

    it('meetingDate → F.meetingDate (MeetingDate)', () => {
      expect(buildPatchBody({ meetingDate: '2026-04-01' })).toHaveProperty(F.meetingDate, '2026-04-01');
    });

    it('category → F.category (Category)', () => {
      expect(buildPatchBody({ category: '朝会' })).toHaveProperty(F.category, '朝会');
    });

    it('summary → F.summary (Summary)', () => {
      expect(buildPatchBody({ summary: '要約' })).toHaveProperty(F.summary, '要約');
    });

    it('decisions → F.decisions (Decisions)', () => {
      expect(buildPatchBody({ decisions: '決定事項' })).toHaveProperty(F.decisions, '決定事項');
    });

    it('actions → F.actions (Actions)', () => {
      expect(buildPatchBody({ actions: 'アクション' })).toHaveProperty(F.actions, 'アクション');
    });

    it('tags → F.tags (Tags)', () => {
      expect(buildPatchBody({ tags: '月次,報告' })).toHaveProperty(F.tags, '月次,報告');
    });

    it('isPublished → F.isPublished (IsPublished) as true', () => {
      expect(buildPatchBody({ isPublished: true })).toHaveProperty(F.isPublished, true);
    });

    it('chair → F.chair (Chair)', () => {
      expect(buildPatchBody({ chair: '田中' })).toHaveProperty(F.chair, '田中');
    });

    it('scribe → F.scribe (Scribe)', () => {
      expect(buildPatchBody({ scribe: '鈴木' })).toHaveProperty(F.scribe, '鈴木');
    });

    it('staffAttendance → F.staffAttendance', () => {
      expect(buildPatchBody({ staffAttendance: '全員出席' })).toHaveProperty(F.staffAttendance, '全員出席');
    });

    it('userHealthNotes → F.userHealthNotes', () => {
      expect(buildPatchBody({ userHealthNotes: '体調良好' })).toHaveProperty(F.userHealthNotes, '体調良好');
    });
  });

  // ── attendees の特別処理 ───────────────────────────────────

  describe('attendees (JSON.stringify)', () => {
    it('should serialize attendees array to JSON string', () => {
      const result = buildPatchBody({ attendees: ['A', 'B', 'C'] });
      expect(result[F.attendees]).toBe(JSON.stringify(['A', 'B', 'C']));
    });

    it('should serialize empty attendees array to "[]"', () => {
      const result = buildPatchBody({ attendees: [] });
      expect(result[F.attendees]).toBe('[]');
    });

    it('should NOT include attendees key when undefined', () => {
      const result = buildPatchBody({ title: 'テスト' });
      expect(result).not.toHaveProperty(F.attendees);
    });

    it('serialized attendees should be parseable back to original', () => {
      const original = ['田中', '鈴木', '山田'];
      const result = buildPatchBody({ attendees: original });
      expect(JSON.parse(result[F.attendees] as string)).toEqual(original);
    });
  });

  // ── PATCH 対象外フィールドを含めない ──────────────────────

  describe('PATCH 対象外フィールドの除外', () => {
    it('should never include id field in patch body', () => {
      // MeetingMinutesUpdateDto に id は存在しない
      const result = buildPatchBody({ title: 'テスト' });
      expect(result).not.toHaveProperty(F.id);
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('Id');
    });

    it('should never include created field in patch body', () => {
      const result = buildPatchBody({ title: 'テスト' });
      expect(result).not.toHaveProperty(F.created);
    });

    it('should never include modified field in patch body', () => {
      const result = buildPatchBody({ title: 'テスト' });
      expect(result).not.toHaveProperty(F.modified);
    });
  });

  // ── 複合更新 ────────────────────────────────────────────────

  describe('複合更新', () => {
    it('should include all provided fields in one call', () => {
      const result = buildPatchBody({
        title: '新タイトル',
        summary: '新要約',
        isPublished: true,
        attendees: ['A', 'B'],
      });
      expect(result).toHaveProperty(F.title, '新タイトル');
      expect(result).toHaveProperty(F.summary, '新要約');
      expect(result).toHaveProperty(F.isPublished, true);
      expect(result).toHaveProperty(F.attendees, JSON.stringify(['A', 'B']));
      // 他は含まれない
      expect(Object.keys(result)).toHaveLength(4);
    });

    it('full patch: all updatable fields should appear in body', () => {
      const patch: MeetingMinutesUpdateDto = {
        title: 'T',
        meetingDate: '2026-04-01',
        category: '職員会議',
        summary: 'S',
        decisions: 'D',
        actions: 'A',
        tags: 'tags',
        relatedLinks: 'https://x.com',
        isPublished: true,
        chair: 'C',
        scribe: 'Sc',
        staffAttendance: 'SA',
        userHealthNotes: 'UN',
        attendees: ['X'],
      };
      const result = buildPatchBody(patch);
      // 13 通常フィールド + 1 attendees = 14
      expect(Object.keys(result)).toHaveLength(14);
    });
  });
});
