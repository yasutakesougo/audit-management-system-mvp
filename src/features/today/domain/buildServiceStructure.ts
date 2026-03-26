/**
 * buildServiceStructure — スケジュール staffLane + Staff マスタ から業務体制を導出
 *
 * staffLane の owner フィールド（role 表記）を ServiceStructure のスロットにマッピングする。
 * Staff マスタの jobTitle / role を参照し、配置されていない役職は在籍スタッフから補完する。
 *
 * ── マッピングルール ──
 *  owner / jobTitle        → ServiceStructure スロット
 *  "受付"                  → playroomStaff / intakeDeskStaff
 *  "看護" / "看護師"        → nurseNames / nursePresent
 *  "支援員" / "生活支援員"  → firstWorkroomStaff / secondWorkroomStaff / supportStaff
 *  "外活動" / "外出"        → outdoorActivityStaff
 *  "和室"                  → japaneseRoomStaff
 *  "プレイルーム"          → playroomStaff
 *  "栄養士" / "管理栄養士"  → mealStaff
 *  "サービス管理責任者"     → serviceManagerNames
 *  "所長" / "施設長"        → directorNames
 *  "送迎"                  → transportStaff
 *  "事務" / "会計"          → accountantNames
 */
import type { ServiceStructure } from './serviceStructure.types';
import type { Staff } from '@/types';

type StaffLaneItem = {
  id: string;
  time: string;
  title: string;
  owner?: string;
};

/** owner 文字列を正規化して分類する */
type RoleCategory =
  | 'reception'
  | 'nurse'
  | 'support'
  | 'outdoor'
  | 'japaneseRoom'
  | 'playroom'
  | 'nutrition'
  | 'manager'
  | 'director'
  | 'transport'
  | 'accounting'
  | 'other';

function classifyOwner(owner: string): RoleCategory {
  const o = owner.trim();
  if (/受付/.test(o)) return 'reception';
  if (/看護/.test(o)) return 'nurse';
  if (/外活動|外出|屋外|散歩/.test(o)) return 'outdoor';
  if (/和室|畳/.test(o)) return 'japaneseRoom';
  if (/プレイルーム|プレイ|遊び/.test(o)) return 'playroom';
  if (/支援員|支援|介護|世話人/.test(o)) return 'support';
  if (/栄養/.test(o)) return 'nutrition';
  if (/サービス管理|サビ管/.test(o)) return 'manager';
  if (/所長|施設長|管理者/.test(o)) return 'director';
  if (/送迎|ドライバー/.test(o)) return 'transport';
  if (/事務|会計|経理/.test(o)) return 'accounting';
  return 'other';
}

function classifyJobTitle(jobTitle: string): RoleCategory {
  return classifyOwner(jobTitle); // 同じロジックで分類
}

function findStaffNameInOwner(owner: string, staffNames: string[]): string | null {
  if (!owner) return null;
  if (staffNames.includes(owner)) return owner;
  const matched = staffNames.find((name) => name.length >= 2 && owner.includes(name));
  return matched ?? null;
}

function pushUnique(map: Map<RoleCategory, string[]>, category: RoleCategory, value: string): void {
  const list = map.get(category) ?? [];
  if (!list.includes(value)) {
    list.push(value);
  }
  map.set(category, list);
}

/**
 * スケジュール staffLane + Staff マスタから ServiceStructure を組み立てる。
 *
 * @param staffLane  - scheduleLanesToday.staffLane
 * @param staffList  - 在籍スタッフ一覧（jobTitle で補完に使用）
 */
export function buildServiceStructure(
  staffLane: StaffLaneItem[],
  staffList: Staff[],
): ServiceStructure {
  const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));
  const activeStaff = staffList.filter((s) => s.active !== false);
  const staffNames = unique(
    activeStaff
      .map((s) => s.name?.trim() ?? '')
      .filter((name) => name.length > 0),
  );
  const staffCategoryByName = new Map<string, RoleCategory>();
  for (const s of activeStaff) {
    const name = s.name?.trim() ?? '';
    if (!name) continue;
    const jt = (s.jobTitle ?? s.role ?? '').trim();
    if (!jt) continue;
    staffCategoryByName.set(name, classifyJobTitle(jt));
  }

  // ── 1. staffLane の owner から配置マップを構築（職員名のみ保持） ──
  const byRole = new Map<RoleCategory, string[]>();
  for (const item of staffLane) {
    const owner = item.owner?.trim() ?? '';
    if (!owner) continue;
    const matchedStaffName = findStaffNameInOwner(owner, staffNames);
    const laneCategory = matchedStaffName
      ? (staffCategoryByName.get(matchedStaffName) ?? classifyOwner(owner))
      : classifyOwner(owner);
    // owner が職員名で解決できない場合は、ロール文字列誤表示を避けるため採用しない
    const displayName = matchedStaffName ?? (laneCategory === 'other' ? owner : null);
    if (!displayName) continue;
    pushUnique(byRole, laneCategory, displayName);
  }

  // ── 2. Staff マスタの jobTitle で補完（職員名） ──
  const staffByRole = new Map<RoleCategory, string[]>();
  for (const s of activeStaff) {
    const name = s.name?.trim() ?? '';
    if (!name) continue;
    const jt = (s.jobTitle ?? s.role ?? '').trim();
    if (!jt) continue;
    const cat = classifyJobTitle(jt);
    pushUnique(staffByRole, cat, name);
  }

  // staffLane 由来の職員名 + staff master 補完名を統合
  const resolve = (cat: RoleCategory): string[] => unique([
    ...(byRole.get(cat) ?? []),
    ...(staffByRole.get(cat) ?? []),
  ]);

  const hasAny = (cat: RoleCategory): boolean => resolve(cat).length > 0;

  // ── 3. ServiceStructure を組み立て ──
  const supportStaff = resolve('support');
  const japaneseRoomStaff = unique([
    ...resolve('japaneseRoom'),
    ...supportStaff.slice(4, 5),
  ]);
  const playroomStaff = unique([
    ...resolve('playroom'),
    ...supportStaff.slice(5),
    ...resolve('reception'),
    ...resolve('nutrition'),
    ...resolve('other'),
  ]);

  return {
    dayCare: {
      firstWorkroomStaff: supportStaff.slice(0, 2),
      secondWorkroomStaff: supportStaff.slice(2, 4),
      outdoorActivityStaff: resolve('outdoor').length > 0
        ? resolve('outdoor')
        : resolve('transport').slice(0, 1),
      japaneseRoomStaff,
      playroomStaff,
    },
    lifeSupport: {
      shortStayCount: 0,   // スケジュールからは不明 — 0 でフォールバック
      temporaryCareCount: 0,
      intakeDeskStaff: resolve('reception'),
      supportStaff: supportStaff.slice(0, 2),
      coordinatorStaff: resolve('manager').slice(0, 1),
      notes: [],
    },
    decisionSupport: {
      directorPresent: hasAny('director'),
      serviceManagerPresent: hasAny('manager'),
      nursePresent: hasAny('nurse'),
      directorNames: resolve('director'),
      serviceManagerNames: resolve('manager'),
      nurseNames: resolve('nurse'),
    },
    operationalSupport: {
      accountantPresent: hasAny('accounting'),
      accountantNames: resolve('accounting'),
      mealStaff: resolve('nutrition'),
      transportStaff: resolve('transport'),
      volunteerStaff: [],    // スケジュールからは不明
      visitorNames: [],      // スケジュールからは不明
    },
  };
}
