import { hasTimeOverlap } from './conflictChecker';

/**
 * ──────────────────────────────────────────────────────────────
 * Room & Equipment Alternative Suggestion Engine (Stage 8)
 * ──────────────────────────────────────────────────────────────
 *
 * 福祉現場での部屋・設備リソース管理
 * 職員・車両代替案エンジンと同じ美しい設計哲学で、空間と設備の最適配置を実現
 */

// ============================================================================
// Room Management Types
// ============================================================================

/** 部屋の基本情報と設備仕様 */
export interface RoomProfile {
  id: string;
  name: string;
  /** 部屋タイプ（相談・訓練・娯楽・会議・医療等） */
  type: 'consultation' | 'training' | 'recreation' | 'meeting' | 'medical' | 'dining' | 'bathroom';
  /** 収容人数 */
  capacity: number;
  /** 面積（平方メートル） */
  area?: number;
  /** 固定設備・機能 */
  fixedEquipment: readonly string[];
  /** 利用可能時間帯 */
  availableHours?: { start: string; end: string };
  /** アクセシビリティ対応 */
  accessibility: readonly string[];
  /** 現在のステータス */
  status: 'available' | 'maintenance' | 'reserved' | 'cleaning';
  /** 清掃・準備時間（分） */
  setupTime?: number;
}

/** 設備の基本情報と利用条件 */
export interface EquipmentProfile {
  id: string;
  name: string;
  /** 設備タイプ */
  type: 'medical' | 'training' | 'mobility' | 'communication' | 'recreation' | 'safety';
  /** 設備カテゴリ */
  category: string;
  /** 同時利用可能数 */
  availableUnits: number;
  /** 利用に必要な資格・スキル */
  requiredSkills: readonly string[];
  /** 設置場所・保管場所 */
  location: string;
  /** メンテナンス予定 */
  maintenanceSchedule?: readonly string[];
  /** 現在のステータス */
  status: 'available' | 'maintenance' | 'in-use' | 'damaged';
  /** 準備・設定時間（分） */
  setupTime?: number;
}

// ============================================================================
// Alternative Suggestion Types
// ============================================================================

/** 部屋代替案の提案結果 */
export interface RoomAlternative {
  roomId: string;
  roomName: string;
  reason: string;
  priority: number;
  equipmentMatched: readonly string[];
  capacitySuitability: 'perfect' | 'adequate' | 'limited' | 'insufficient';
  accessibilityMatch: readonly string[];
  currentlyOccupied: boolean;
  usageWarning?: string;
  setupTimeRequired?: number;
}

/** 設備代替案の提案結果 */
export interface EquipmentAlternative {
  equipmentId: string;
  equipmentName: string;
  reason: string;
  priority: number;
  skillRequirementsMet: boolean;
  availableUnits: number;
  currentlyInUse: number;
  locationNote: string;
  availabilityWarning?: string;
  setupTimeRequired?: number;
}

/** 部屋代替案エンジンの入力パラメータ */
export interface RoomAlternativeRequest {
  targetSchedule: { start: string; end: string; id: string; title?: string; };
  requiredCapacity?: number;
  requiredEquipment?: readonly string[];
  requiredAccessibility?: readonly string[];
  preferredRoomTypes?: readonly RoomProfile['type'][];
  excludeRoomIds?: readonly string[];
  maxSuggestions?: number;
}

/** 設備代替案エンジンの入力パラメータ */
export interface EquipmentAlternativeRequest {
  targetSchedule: { start: string; end: string; id: string; title?: string; };
  requiredEquipmentTypes?: readonly string[];
  requiredSkills?: readonly string[];
  requiredUnits?: number;
  excludeEquipmentIds?: readonly string[];
  maxSuggestions?: number;
}

// ============================================================================
// Core Alternative Engine Functions
// ============================================================================

/**
 * 部屋代替案を提案する中核関数
 */
export function suggestRoomAlternatives(
  request: RoomAlternativeRequest,
  allRooms: readonly RoomProfile[],
  allSchedules: readonly { start: string; end: string; id: string; }[],
): RoomAlternative[] {
  const {
    targetSchedule,
    requiredCapacity = 1,
    requiredEquipment = [],
    requiredAccessibility = [],
    preferredRoomTypes = [],
    excludeRoomIds = [],
    maxSuggestions = 3,
  } = request;

  const { start, end } = targetSchedule;

  // 基本フィルタリング：除外対象・利用不可部屋を排除
  const candidateRooms = allRooms.filter(
    room =>
      !excludeRoomIds.includes(room.id) &&
      room.status === 'available' &&
      room.capacity >= requiredCapacity
  );

  // 各部屋の適合性を評価
  const evaluatedAlternatives = candidateRooms
    .map(room => evaluateRoomForAlternative(room, start, end, requiredEquipment, requiredAccessibility, preferredRoomTypes, allSchedules))
    .filter(alternative => alternative !== null) as RoomAlternative[];

  // 優先度でソートして返却
  return evaluatedAlternatives
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxSuggestions);
}

/**
 * 設備代替案を提案する中核関数
 */
export function suggestEquipmentAlternatives(
  request: EquipmentAlternativeRequest,
  allEquipment: readonly EquipmentProfile[],
  allSchedules: readonly { start: string; end: string; id: string; }[],
): EquipmentAlternative[] {
  const {
    targetSchedule,
    requiredEquipmentTypes = [],
    requiredSkills = [],
    requiredUnits = 1,
    excludeEquipmentIds = [],
    maxSuggestions = 3,
  } = request;

  const { start, end } = targetSchedule;

  // 基本フィルタリング：除外対象・利用不可設備を排除
  const candidateEquipment = allEquipment.filter(
    equipment =>
      !excludeEquipmentIds.includes(equipment.id) &&
      equipment.status === 'available' &&
      equipment.availableUnits >= requiredUnits
  );

  // 各設備の適合性を評価
  const evaluatedAlternatives = candidateEquipment
    .map(equipment => evaluateEquipmentForAlternative(equipment, start, end, requiredEquipmentTypes, requiredSkills, requiredUnits, allSchedules))
    .filter(alternative => alternative !== null) as EquipmentAlternative[];

  // 優先度でソートして返却
  return evaluatedAlternatives
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxSuggestions);
}

// ============================================================================
// Individual Evaluation Functions
// ============================================================================

/**
 * 単一部屋の代替案適合性を評価
 */
function evaluateRoomForAlternative(
  room: RoomProfile,
  startTime: string,
  endTime: string,
  requiredEquipment: readonly string[],
  requiredAccessibility: readonly string[],
  preferredRoomTypes: readonly RoomProfile['type'][],
  allSchedules: readonly { start: string; end: string; id: string; }[],
): RoomAlternative | null {
  // 時間帯重複チェック（部屋使用状況）
  const isCurrentlyOccupied = isRoomBusyDuringTime(room.id, startTime, endTime, allSchedules);

  // 設備マッチング
  const equipmentMatched = requiredEquipment.length > 0
    ? room.fixedEquipment.filter(equipment => requiredEquipment.includes(equipment))
    : [...room.fixedEquipment];

  // アクセシビリティマッチング
  const accessibilityMatch = requiredAccessibility.length > 0
    ? room.accessibility.filter(feature => requiredAccessibility.includes(feature))
    : [...room.accessibility];

  // 定員適合性評価
  const capacitySuitability = evaluateCapacitySuitability(room.capacity, 1); // 仮の人数

  // 優先度計算
  const priority = calculateRoomPriority(room, equipmentMatched, requiredEquipment, accessibilityMatch, requiredAccessibility, preferredRoomTypes, isCurrentlyOccupied);

  // 提案理由の生成
  const reason = generateRoomAlternativeReason(room, isCurrentlyOccupied, equipmentMatched, accessibilityMatch, capacitySuitability);

  // 使用上の警告チェック
  const usageWarning = checkRoomUsageWarning(room, startTime, endTime);

  return {
    roomId: room.id,
    roomName: room.name,
    reason,
    priority,
    equipmentMatched,
    capacitySuitability,
    accessibilityMatch,
    currentlyOccupied: isCurrentlyOccupied,
    usageWarning: usageWarning || undefined,
    setupTimeRequired: room.setupTime,
  };
}

/**
 * 単一設備の代替案適合性を評価
 */
function evaluateEquipmentForAlternative(
  equipment: EquipmentProfile,
  startTime: string,
  endTime: string,
  requiredEquipmentTypes: readonly string[],
  requiredSkills: readonly string[],
  requiredUnits: number,
  allSchedules: readonly { start: string; end: string; id: string; }[],
): EquipmentAlternative | null {
  // 時間帯重複チェック（設備使用状況）
  const currentlyInUse = getEquipmentUnitsInUse(equipment.id, startTime, endTime, allSchedules);
  const availableUnits = equipment.availableUnits - currentlyInUse;

  if (availableUnits < requiredUnits) {
    return null; // 必要数が確保できない場合は候補から除外
  }

  // スキル要件マッチング
  const skillRequirementsMet = requiredSkills.length === 0 ||
    requiredSkills.every(skill => equipment.requiredSkills.includes(skill));

  // 優先度計算
  const priority = calculateEquipmentPriority(equipment, requiredEquipmentTypes, skillRequirementsMet, availableUnits, requiredUnits);

  // 提案理由の生成
  const reason = generateEquipmentAlternativeReason(equipment, availableUnits, requiredUnits, skillRequirementsMet);

  // 可用性警告チェック
  const availabilityWarning = checkEquipmentAvailabilityWarning(equipment, startTime, endTime);

  return {
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    reason,
    priority,
    skillRequirementsMet,
    availableUnits: equipment.availableUnits,
    currentlyInUse,
    locationNote: equipment.location,
    availabilityWarning: availabilityWarning || undefined,
    setupTimeRequired: equipment.setupTime,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 指定時間帯に部屋が使用中かどうかを判定
 */
function isRoomBusyDuringTime(
  roomId: string,
  startTime: string,
  endTime: string,
  allSchedules: readonly { start: string; end: string; id: string; }[],
): boolean {
  return allSchedules.some(schedule => {
    // 部屋が関与するスケジュールを特定（今回は簡易版）
    const isRoomInvolved = schedule.id.includes('room'); // 仮の実装

    if (!isRoomInvolved) return false;

    // 時間重複をチェック
    return hasTimeOverlap(startTime, endTime, schedule.start, schedule.end);
  });
}

/**
 * 指定時間帯に設備が何台使用されているかを取得
 */
function getEquipmentUnitsInUse(
  equipmentId: string,
  startTime: string,
  endTime: string,
  allSchedules: readonly { start: string; end: string; id: string; }[],
): number {
  let unitsInUse = 0;

  allSchedules.forEach(schedule => {
    // 設備が関与するスケジュールを特定（今回は簡易版）
    const isEquipmentInvolved = schedule.id.includes('equipment'); // 仮の実装

    if (isEquipmentInvolved && hasTimeOverlap(startTime, endTime, schedule.start, schedule.end)) {
      unitsInUse += 1; // 1つのスケジュールで1台使用と仮定
    }
  });

  return unitsInUse;
}

/**
 * 定員適合性を評価
 */
function evaluateCapacitySuitability(roomCapacity: number, requiredCapacity: number): RoomAlternative['capacitySuitability'] {
  if (roomCapacity === requiredCapacity) return 'perfect';
  if (roomCapacity >= requiredCapacity * 1.5) return 'adequate';
  if (roomCapacity >= requiredCapacity) return 'limited';
  return 'insufficient';
}

/**
 * 部屋の提案優先度を計算
 */
function calculateRoomPriority(
  room: RoomProfile,
  equipmentMatched: readonly string[],
  requiredEquipment: readonly string[],
  accessibilityMatch: readonly string[],
  requiredAccessibility: readonly string[],
  preferredRoomTypes: readonly RoomProfile['type'][],
  isCurrentlyOccupied: boolean,
): number {
  let priority = 0;

  // ベース優先度：利用可能な部屋を優先
  if (!isCurrentlyOccupied) {
    priority += 100;
  }

  // 設備マッチング加点
  const equipmentMatchRatio = requiredEquipment.length > 0
    ? equipmentMatched.length / requiredEquipment.length
    : 1;
  priority += Math.floor(equipmentMatchRatio * 40);

  // アクセシビリティマッチング加点
  const accessibilityMatchRatio = requiredAccessibility.length > 0
    ? accessibilityMatch.length / requiredAccessibility.length
    : 1;
  priority += Math.floor(accessibilityMatchRatio * 30);

  // 部屋タイプ適合性加点
  if (preferredRoomTypes.length === 0 || preferredRoomTypes.includes(room.type)) {
    priority += 20;
  }

  // 医療・相談室の特別加点
  if (['medical', 'consultation'].includes(room.type)) {
    priority += 15;
  }

  return priority;
}

/**
 * 設備の提案優先度を計算
 */
function calculateEquipmentPriority(
  equipment: EquipmentProfile,
  requiredEquipmentTypes: readonly string[],
  skillRequirementsMet: boolean,
  availableUnits: number,
  requiredUnits: number,
): number {
  let priority = 0;

  // ベース優先度：十分な台数が利用可能
  priority += Math.min(availableUnits / requiredUnits * 50, 100);

  // スキル要件マッチング加点
  if (skillRequirementsMet) {
    priority += 30;
  }

  // 設備タイプマッチング加点
  if (requiredEquipmentTypes.length === 0 || requiredEquipmentTypes.includes(equipment.type)) {
    priority += 20;
  }

  // 医療・安全設備の特別加点
  if (['medical', 'safety'].includes(equipment.type)) {
    priority += 25;
  }

  return priority;
}

/**
 * 部屋代替案の提案理由を生成
 */
function generateRoomAlternativeReason(
  room: RoomProfile,
  isCurrentlyOccupied: boolean,
  equipmentMatched: readonly string[],
  accessibilityMatch: readonly string[],
  capacitySuitability: RoomAlternative['capacitySuitability'],
): string {
  if (isCurrentlyOccupied) {
    return '別の予定で使用中です';
  }

  const reasonParts = ['この時間に利用可能'];

  // 設備適合性の説明
  if (equipmentMatched.length > 0) {
    const equipmentText = equipmentMatched.slice(0, 2).join('・');
    reasonParts.push(`${equipmentText}設備`);
  }

  // 定員適合性の説明
  const capacityText = {
    perfect: '定員最適',
    adequate: '定員十分',
    limited: '定員限定的',
    insufficient: '定員不足',
  }[capacitySuitability];
  reasonParts.push(capacityText);

  // アクセシビリティの説明
  if (accessibilityMatch.length > 0) {
    const accessibilityText = accessibilityMatch.slice(0, 1).join('・');
    reasonParts.push(`${accessibilityText}対応`);
  }

  return reasonParts.join(' / ');
}

/**
 * 設備代替案の提案理由を生成
 */
function generateEquipmentAlternativeReason(
  equipment: EquipmentProfile,
  availableUnits: number,
  requiredUnits: number,
  skillRequirementsMet: boolean,
): string {
  const reasonParts = [`${availableUnits}台利用可能`];

  if (availableUnits > requiredUnits) {
    reasonParts.push(`(必要${requiredUnits}台)`);
  }

  if (skillRequirementsMet) {
    reasonParts.push('資格要件適合');
  }

  reasonParts.push(`保管場所: ${equipment.location}`);

  return reasonParts.join(' / ');
}

/**
 * 部屋使用上の警告をチェック
 */
function checkRoomUsageWarning(
  room: RoomProfile,
  startTime: string,
  _endTime: string,
): string | null {
  // 清掃時間との重複チェック
  if (room.status === 'cleaning') {
    return '清掃作業と重複の可能性';
  }

  // 利用可能時間帯チェック
  if (room.availableHours) {
    const scheduleStart = new Date(startTime);
    const availableStart = new Date(`${startTime.split('T')[0]}T${room.availableHours.start}`);
    const availableEnd = new Date(`${startTime.split('T')[0]}T${room.availableHours.end}`);

    if (scheduleStart < availableStart || scheduleStart > availableEnd) {
      return '利用可能時間外の使用';
    }
  }

  return null;
}

/**
 * 設備可用性警告をチェック
 */
function checkEquipmentAvailabilityWarning(
  equipment: EquipmentProfile,
  startTime: string,
  _endTime: string,
): string | null {
  // メンテナンス予定との重複チェック
  if (equipment.maintenanceSchedule?.some(maintenanceDate => {
    const scheduleDate = new Date(startTime).toDateString();
    return new Date(maintenanceDate).toDateString() === scheduleDate;
  })) {
    return 'メンテナンス予定と重複の可能性';
  }

  return null;
}

// ============================================================================
// Demo Data Generation
// ============================================================================

/**
 * デモ用の部屋プロファイルを生成
 */
export function generateDemoRoomProfiles(): RoomProfile[] {
  return [
    {
      id: 'room-consultation-001',
      name: '相談室A',
      type: 'consultation',
      capacity: 4,
      area: 15,
      fixedEquipment: ['机', '椅子', 'ホワイトボード', 'プライバシーカーテン'],
      availableHours: { start: '09:00', end: '17:00' },
      accessibility: ['車椅子対応', '手すり設置'],
      status: 'available',
      setupTime: 10,
    },
    {
      id: 'room-training-001',
      name: '機能訓練室',
      type: 'training',
      capacity: 10,
      area: 40,
      fixedEquipment: ['平行棒', '昇降台', 'マット', 'ミラー'],
      availableHours: { start: '08:30', end: '18:00' },
      accessibility: ['車椅子対応', '手すり設置', '滑り止め床材'],
      status: 'available',
      setupTime: 15,
    },
    {
      id: 'room-recreation-001',
      name: 'プレイルーム',
      type: 'recreation',
      capacity: 15,
      area: 60,
      fixedEquipment: ['テレビ', '音響設備', '収納棚', 'カラオケ機器'],
      availableHours: { start: '09:00', end: '21:00' },
      accessibility: ['車椅子対応', '音響補助設備'],
      status: 'available',
      setupTime: 20,
    },
    {
      id: 'room-dining-001',
      name: '食堂',
      type: 'dining',
      capacity: 30,
      area: 100,
      fixedEquipment: ['テーブル', '椅子', '手洗い設備', '配膳台'],
      availableHours: { start: '06:00', end: '20:00' },
      accessibility: ['車椅子対応', '高さ調整テーブル'],
      status: 'available',
      setupTime: 30,
    },
  ];
}

/**
 * デモ用の設備プロファイルを生成
 */
export function generateDemoEquipmentProfiles(): EquipmentProfile[] {
  return [
    {
      id: 'equipment-lift-001',
      name: '移乗リフト',
      type: 'mobility',
      category: '移乗支援',
      availableUnits: 2,
      requiredSkills: ['移乗介助', '機械操作'],
      location: '機能訓練室',
      status: 'available',
      setupTime: 15,
    },
    {
      id: 'equipment-wheelchair-001',
      name: '車椅子(標準)',
      type: 'mobility',
      category: '移動支援',
      availableUnits: 8,
      requiredSkills: [],
      location: '玄関ホール',
      status: 'available',
      setupTime: 5,
    },
    {
      id: 'equipment-communication-001',
      name: 'コミュニケーションボード',
      type: 'communication',
      category: '意思疎通支援',
      availableUnits: 3,
      requiredSkills: ['コミュニケーション支援'],
      location: '相談室',
      status: 'available',
      setupTime: 10,
    },
    {
      id: 'equipment-medical-001',
      name: 'バイタルサインモニター',
      type: 'medical',
      category: '健康管理',
      availableUnits: 1,
      requiredSkills: ['看護師', '健康管理'],
      location: '医務室',
      status: 'available',
      setupTime: 20,
    },
    {
      id: 'equipment-training-001',
      name: 'バランスボール',
      type: 'training',
      category: '機能訓練',
      availableUnits: 5,
      requiredSkills: ['機能訓練指導員'],
      location: '機能訓練室',
      status: 'available',
      setupTime: 5,
    },
  ];
}