import { hasTimeOverlap } from './conflictChecker';

/**
 * ──────────────────────────────────────────────────────────────
 * Vehicle & Resource Alternative Suggestion Engine
 * ──────────────────────────────────────────────────────────────
 *
 * Stage 7: ConflictRuleシステムの拡張による車両・部屋・設備リソース管理
 * 職員代替案エンジンと同じ美しい設計哲学で、物理リソースの最適配置を実現
 */

// ============================================================================
// Vehicle Management Types
// ============================================================================

/** 車両の基本情報と装備仕様 */
export interface VehicleProfile {
  id: string;
  name: string;
  /** 車両タイプ（ワゴン・軽自動車・福祉車両等） */
  type: 'wagon' | 'compact' | 'welfare' | 'bus';
  /** 定員数 */
  capacity: number;
  /** 装備・仕様 */
  features: readonly string[];
  /** 利用可能曜日 */
  availableDays?: readonly string[];
  /** メンテナンス予定 */
  maintenanceSchedule?: readonly string[];
  /** 現在のステータス */
  status: 'available' | 'maintenance' | 'out-of-service';
}

/** 車両代替案の提案結果 */
export interface VehicleAlternative {
  vehicleId: string;
  vehicleName: string;
  reason: string;
  priority: number;
  featuresMatched: readonly string[];
  capacityMatch: 'perfect' | 'sufficient' | 'insufficient';
  currentlyBooked: boolean;
  availabilityWarning?: string;
}

/** 車両代替案エンジンの入力パラメータ */
export interface VehicleAlternativeRequest {
  targetSchedule: { start: string; end: string; id: string; }; // より緩やかな型
  requiredFeatures?: readonly string[];
  requiredCapacity?: number;
  excludeVehicleIds?: readonly string[];
  maxSuggestions?: number;
}

// ============================================================================
// Room/Facility Management Types
// ============================================================================

/** 部屋・施設の基本情報 */
export interface RoomProfile {
  id: string;
  name: string;
  /** 部屋タイプ */
  type: 'consultation' | 'training' | 'recreation' | 'meeting' | 'medical';
  /** 収容人数 */
  capacity: number;
  /** 設備・機能 */
  equipment: readonly string[];
  /** 利用可能時間帯 */
  availableHours?: { start: string; end: string };
  /** 現在のステータス */
  status: 'available' | 'maintenance' | 'reserved';
}

/** 部屋代替案の提案結果 */
export interface RoomAlternative {
  roomId: string;
  roomName: string;
  reason: string;
  priority: number;
  equipmentMatched: readonly string[];
  capacitySuitability: 'perfect' | 'adequate' | 'limited';
  currentlyOccupied: boolean;
  usageWarning?: string;
}

// ============================================================================
// Resource Alternative Engine Core Functions
// ============================================================================

/**
 * 車両代替案を提案する中核関数
 */
export function suggestVehicleAlternatives(
  request: VehicleAlternativeRequest,
  allVehicles: readonly VehicleProfile[],
  allSchedules: readonly { start: string; end: string; id: string; }[], // より緩やかな型
): VehicleAlternative[] {
  const {
    targetSchedule,
    requiredFeatures = [],
    requiredCapacity = 1,
    excludeVehicleIds = [],
    maxSuggestions = 3,
  } = request;

  const { start, end } = targetSchedule;

  // 基本フィルタリング：除外対象・利用不可車両を排除
  const candidateVehicles = allVehicles.filter(
    vehicle =>
      !excludeVehicleIds.includes(vehicle.id) &&
      vehicle.status === 'available'
  );

  // 各車両の適合性を評価
  const evaluatedAlternatives = candidateVehicles
    .map(vehicle => evaluateVehicleForAlternative(vehicle, start, end, requiredFeatures, requiredCapacity, allSchedules))
    .filter(alternative => alternative !== null) as VehicleAlternative[];

  // 優先度でソートして返却
  return evaluatedAlternatives
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxSuggestions);
}

/**
 * 単一車両の代替案適合性を評価
 */
function evaluateVehicleForAlternative(
  vehicle: VehicleProfile,
  startTime: string,
  endTime: string,
  requiredFeatures: readonly string[],
  requiredCapacity: number,
  allSchedules: readonly { start: string; end: string; id: string; }[], // より緩やかな型
): VehicleAlternative | null {
  // 時間帯重複チェック（車両予約状況）
  const isCurrentlyBooked = isVehicleBusyDuringTime(vehicle.id, startTime, endTime, allSchedules);

  // 装備マッチング
  const featuresMatched = requiredFeatures.length > 0
    ? vehicle.features.filter(feature => requiredFeatures.includes(feature))
    : [...vehicle.features];

  // 定員適合性
  const capacityMatch: VehicleAlternative['capacityMatch'] =
    vehicle.capacity === requiredCapacity ? 'perfect' :
    vehicle.capacity >= requiredCapacity ? 'sufficient' : 'insufficient';

  // 優先度計算
  const priority = calculateVehiclePriority(vehicle, featuresMatched, requiredFeatures, capacityMatch, isCurrentlyBooked);

  // 提案理由の生成
  const reason = generateVehicleAlternativeReason(vehicle, isCurrentlyBooked, featuresMatched, capacityMatch);

  // 可用性警告チェック
  const availabilityWarning = checkVehicleAvailabilityWarning(vehicle, startTime, endTime);

  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    reason,
    priority,
    featuresMatched,
    capacityMatch,
    currentlyBooked: isCurrentlyBooked,
    availabilityWarning: availabilityWarning || undefined,
  };
}

/**
 * 指定時間帯に車両が利用中かどうかを判定
 */
function isVehicleBusyDuringTime(
  vehicleId: string,
  startTime: string,
  endTime: string,
  allSchedules: readonly { start: string; end: string; id: string; }[], // より緩やかな型
): boolean {
  return allSchedules.some(schedule => {
    // 車両が関与するスケジュールを特定（今回は簡易版）
    const isVehicleInvolved = schedule.id.includes('vehicle'); // 仮の実装

    if (!isVehicleInvolved) return false;

    // 時間重複をチェック
    return hasTimeOverlap(startTime, endTime, schedule.start, schedule.end);
  });
}

/**
 * 車両の提案優先度を計算
 */
function calculateVehiclePriority(
  vehicle: VehicleProfile,
  featuresMatched: readonly string[],
  requiredFeatures: readonly string[],
  capacityMatch: VehicleAlternative['capacityMatch'],
  isCurrentlyBooked: boolean,
): number {
  let priority = 0;

  // ベース優先度：利用可能な車両を優先
  if (!isCurrentlyBooked) {
    priority += 100;
  }

  // 装備マッチング加点
  const featureMatchRatio = requiredFeatures.length > 0
    ? featuresMatched.length / requiredFeatures.length
    : 1;
  priority += Math.floor(featureMatchRatio * 40);

  // 定員適合性加点
  if (capacityMatch === 'perfect') priority += 30;
  else if (capacityMatch === 'sufficient') priority += 20;

  // 福祉車両の特別加点
  if (featuresMatched.some(feature => ['車椅子対応', 'リフト装備', 'ストレッチャー対応'].includes(feature))) {
    priority += 25;
  }

  return priority;
}

/**
 * 車両代替案の提案理由を生成
 */
function generateVehicleAlternativeReason(
  vehicle: VehicleProfile,
  isCurrentlyBooked: boolean,
  featuresMatched: readonly string[],
  capacityMatch: VehicleAlternative['capacityMatch'],
): string {
  if (isCurrentlyBooked) {
    return '別の予定で使用中です';
  }

  const reasonParts = ['この時間に利用可能'];

  // 装備適合性の説明
  if (featuresMatched.length > 0) {
    const featureText = featuresMatched.slice(0, 2).join('・');
    reasonParts.push(`${featureText}装備`);
  }

  // 定員適合性の説明
  if (capacityMatch === 'perfect') {
    reasonParts.push(`定員${vehicle.capacity}名（最適）`);
  } else if (capacityMatch === 'sufficient') {
    reasonParts.push(`定員${vehicle.capacity}名（十分）`);
  }

  return reasonParts.join(' / ');
}

/**
 * 車両可用性警告をチェック
 */
function checkVehicleAvailabilityWarning(
  vehicle: VehicleProfile,
  startTime: string,
  _endTime: string,
): string | null {
  // メンテナンス予定との重複チェック
  if (vehicle.maintenanceSchedule?.some(maintenanceDate => {
    const scheduleDate = new Date(startTime).toDateString();
    return new Date(maintenanceDate).toDateString() === scheduleDate;
  })) {
    return 'メンテナンス予定と重複の可能性';
  }

  return null;
}

/**
 * デモ用の車両プロファイルを生成
 */
export function generateDemoVehicleProfiles(): VehicleProfile[] {
  return [
    {
      id: 'vehicle-001',
      name: '送迎車両01',
      type: 'welfare',
      capacity: 6,
      features: ['車椅子対応', 'リフト装備', 'エアコン'],
      availableDays: ['月', '火', '水', '木', '金'],
      status: 'available',
    },
    {
      id: 'vehicle-002',
      name: '送迎車両02',
      type: 'wagon',
      capacity: 8,
      features: ['車椅子対応', 'エアコン', 'ドライブレコーダー'],
      availableDays: ['月', '火', '水', '木', '金', '土'],
      status: 'available',
    },
    {
      id: 'vehicle-003',
      name: '緊急車両',
      type: 'compact',
      capacity: 4,
      features: ['エアコン', '緊急装備'],
      availableDays: ['月', '火', '水', '木', '金', '土', '日'],
      status: 'available',
    },
    {
      id: 'vehicle-004',
      name: 'マイクロバス',
      type: 'bus',
      capacity: 20,
      features: ['車椅子対応', 'リフト装備', 'エアコン', 'マイク設備'],
      availableDays: ['土', '日'],
      status: 'available',
    },
  ];
}