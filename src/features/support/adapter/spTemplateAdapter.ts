/**
 * SP SupportTemplateItem → Domain SupportStepTemplate 変換 Adapter
 *
 * SharePoint の SupportTemplates リストから取得した行を
 * ドメインモデル (SupportStepTemplate) に変換する。
 *
 * マッピング:
 * - Activity       → stepTitle       (活動内容)
 * - PersonManual   → targetBehavior  (本人の動き)
 * - SupporterManual → supportMethod  (支援者の動き)
 * - TimeSlot       → timeSlot        (時間帯 — 正規化)
 * - RowNo          → ソート順
 */
import type { SupportStepTemplate, TimeSlot } from '@/domain/support/step-templates';
import { standardTimeSlotValues } from '@/domain/support/step-templates';
import type { SupportTemplateItem } from '../../../features/daily/infra/SharePointProcedureTemplateRepository';

/**
 * SP の自由書式時間帯 (e.g., "9:30頃", "10:20〜12:00") を
 * ドメインの TimeSlot enum に最近接マッチングする。
 */
function normalizeTimeSlot(raw: string): TimeSlot {
  // 先頭の数字部分を抽出 (e.g., "9:30頃" → 9, 30)
  const match = raw.match(/(\d{1,2}):?(\d{2})?/);
  if (!match) return standardTimeSlotValues[0]; // fallback

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2] ?? '0', 10);
  const totalMinutes = hour * 60 + minute;

  // 各スロットの開始時刻との距離が最小のものを選択
  let bestSlot: TimeSlot = standardTimeSlotValues[0];
  let bestDist = Infinity;

  for (const slot of standardTimeSlotValues) {
    const [start] = slot.split('-');
    const [sh, sm] = start.split(':').map(Number);
    const slotMinutes = sh * 60 + sm;
    const dist = Math.abs(totalMinutes - slotMinutes);
    if (dist < bestDist) {
      bestDist = dist;
      bestSlot = slot;
    }
  }

  return bestSlot;
}

/**
 * timeSlot からカテゴリを推定する。
 */
function inferCategory(timeSlot: TimeSlot): string {
  const hour = parseInt(timeSlot.split(':')[0], 10);
  if (hour < 10) return '朝の準備';
  if (hour < 12) return 'AM活動';
  if (hour < 13) return '昼食';
  if (hour < 14) return '休憩';
  if (hour < 15) return 'PM活動';
  return '終了準備';
}

/**
 * SP SupportTemplateItem → Domain SupportStepTemplate
 */
export function mapSpTemplateToStepTemplate(item: SupportTemplateItem): SupportStepTemplate {
  const timeSlot = normalizeTimeSlot(item.TimeSlot || '09:30');
  return {
    id: `sp-${item.Id ?? item.RowNo}`,
    timeSlot,
    stepTitle: item.Activity || '',
    category: inferCategory(timeSlot) as SupportStepTemplate['category'],
    description: item.Activity || '',
    targetBehavior: item.PersonManual || '',
    supportMethod: item.SupporterManual || '',
    precautions: undefined,
    duration: 60,
    importance: '必須',
    isRequired: true,
    iconEmoji: undefined,
  };
}

/**
 * SP SupportTemplateItem[] → Domain SupportStepTemplate[]
 * RowNo でソート済みの状態で返す。
 */
export function mapSpTemplatesToStepTemplates(items: SupportTemplateItem[]): SupportStepTemplate[] {
  return items
    .sort((a, b) => a.RowNo - b.RowNo)
    .map(mapSpTemplateToStepTemplate);
}

/**
 * Domain SupportStepTemplate → SP SupportTemplateItem (逆変換)
 * Create/Update 用。SP 側に存在しないフィールド (category, importance, etc.) は捨てる。
 */
export function mapStepTemplateToSpItem(
  template: SupportStepTemplate,
  userCode: string,
  rowNo: number
): Omit<SupportTemplateItem, 'Id' | 'Created' | 'Modified'> {
  return {
    Title: `${userCode}_${template.stepTitle}`,
    UserCode: userCode,
    RowNo: rowNo,
    TimeSlot: template.timeSlot,
    Activity: template.stepTitle,
    PersonManual: template.targetBehavior || null,
    SupporterManual: template.supportMethod || null,
  };
}
