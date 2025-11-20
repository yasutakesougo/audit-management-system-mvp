// userMasterDashboardUtils.ts

import type { IUserMaster } from "./types";

/**
 * 月キー（例: "2025-11"）と日付文字列（"2025-11-03" 等）が同じ年月か判定
 */
const isInMonth = (dateStr: string, monthKey: string): boolean => {
  if (!dateStr || !monthKey) return false;
  return dateStr.slice(0, 7) === monthKey.slice(0, 7);
};

export type UsageMap = Record<
  string,
  {
    grantedDays: number;
    usedDays: number;
  }
>;

/**
 * 支援記録（ISupportRecordDaily 等）から今月の利用日数を集計し、利用者マスタと結合して usageMap を生成
 */
export function calculateUsageFromDailyRecords<TRecord>(
  records: TRecord[],
  users: IUserMaster[],
  monthKey: string,
  options: {
    userKey: (record: TRecord) => string;
    dateKey: (record: TRecord) => string;
    countRule?: (record: TRecord) => boolean;
  }
): UsageMap {
  const { userKey, dateKey, countRule } = options;
  const daysPerUser = new Map<string, Set<string>>();

  for (const record of records) {
    const u = userKey(record);
    const d = dateKey(record);
    if (!u || !d) continue;
    if (!isInMonth(d, monthKey)) continue;
    if (countRule && !countRule(record)) continue;

    let set = daysPerUser.get(u);
    if (!set) {
      set = new Set<string>();
      daysPerUser.set(u, set);
    }
    set.add(d);
  }

  const usageMap: UsageMap = {};

  for (const user of users) {
    const userId = user.UserID;
    if (!userId) continue;

    const grantedRaw = user.GrantedDaysPerMonth;
    const grantedNumber = grantedRaw ? parseInt(grantedRaw, 10) : NaN;
    const grantedDays = Number.isFinite(grantedNumber) && grantedNumber > 0 ? grantedNumber : 0;
    const usedDays = daysPerUser.get(userId)?.size ?? 0;

    usageMap[userId] = {
      grantedDays,
      usedDays,
    };
  }

  return usageMap;
}

/**
 * 指定月の残り利用可能日数を計算
 * @param user 対象利用者
 * @param grantedDaysPerMonth 契約支給量（日数/月）を数値として渡す（文字列なら parse してから）
 * @param usedDays 今月すでに利用した日数（支援記録から集計して渡す）
 */
export const calculateRemainingDays = (
  user: IUserMaster,
  grantedDaysPerMonth: number,
  usedDays: number
): number => {
  const granted = Number.isFinite(grantedDaysPerMonth)
    ? grantedDaysPerMonth
    : parseInt(user.GrantedDaysPerMonth || "0", 10);

  const safeUsed = Number.isFinite(usedDays) ? usedDays : 0;
  return Math.max(0, granted - safeUsed);
};

/**
 * 残り日数からアラート種別を判定
 */
export const getRemainingDaysAlert = (
  remainingDays: number
): "success" | "warning" | "error" => {
  if (remainingDays >= 10) return "success";
  if (remainingDays >= 5) return "warning";
  return "error";
};

/**
 * 受給者証有効期限の状態を判定
 */
export const getCertExpiryStatus = (
  user: IUserMaster
): {
  status: "valid" | "warning" | "expired";
  daysUntilExpiry: number;
  message: string;
} => {
  if (!user.RecipientCertExpiry) {
    return {
      status: "warning",
      daysUntilExpiry: 0,
      message: "受給者証有効期限が未登録です",
    };
  }

  const today = new Date();
  const expiryDate = new Date(user.RecipientCertExpiry);

  // 日付がパースできない場合のガード
  if (Number.isNaN(expiryDate.getTime())) {
    return {
      status: "warning",
      daysUntilExpiry: 0,
      message: "受給者証有効期限の日付形式が不正です",
    };
  }

  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "expired",
      daysUntilExpiry: diffDays,
      message: "受給者証の有効期限が切れています",
    };
  }

  if (diffDays <= 30) {
    return {
      status: "warning",
      daysUntilExpiry: diffDays,
      message: `受給者証の有効期限まで${diffDays}日です`,
    };
  }

  return {
    status: "valid",
    daysUntilExpiry: diffDays,
    message: "受給者証は有効です",
  };
};

/**
 * 支給決定期間の状態を判定
 */
export const getGrantPeriodStatus = (
  user: IUserMaster
): {
  isActive: boolean;
  daysRemaining: number;
  renewalRequired: boolean;
} => {
  const today = new Date();
  const startDate = user.GrantPeriodStart
    ? new Date(user.GrantPeriodStart)
    : null;
  const endDate = user.GrantPeriodEnd ? new Date(user.GrantPeriodEnd) : null;

  if (!startDate || !endDate) {
    return {
      isActive: false,
      daysRemaining: 0,
      renewalRequired: true,
    };
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      isActive: false,
      daysRemaining: 0,
      renewalRequired: true,
    };
  }

  const isActive = today >= startDate && today <= endDate;
  const daysRemaining = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const renewalRequired = daysRemaining <= 60; // 60日以内なら更新要警告

  return { isActive, daysRemaining, renewalRequired };
};

/**
 * 請求・加算管理のサマリー情報を生成
 */
export const generateBillingOverview = (users: IUserMaster[]): {
  transportAdditionCount: Record<string, number>;
  mealAdditionUsers: number;
  copayMethods: Record<string, number>;
  totalActiveUsers: number;
} => {
  const activeUsers = users.filter(user => user.UsageStatus === '利用中');

  return {
    transportAdditionCount: countByField(activeUsers.map(u => ({ value: u.TransportAdditionType })), 'value'),
    mealAdditionUsers: activeUsers.filter(user => user.MealAddition === 'use').length,
    copayMethods: countByField(activeUsers.map(u => ({ value: u.CopayPaymentMethod })), 'value'),
    totalActiveUsers: activeUsers.length,
  };
};

/**
 * 利用者配列から指定フィールドの値別カウントを取得
 */
const countByField = <T extends Record<string, string | number | boolean | null | undefined>>(
  items: T[],
  fieldKey: keyof T
): Record<string, number> => {
  return items.reduce((acc, item) => {
    const value = item[fieldKey] || '未設定';
    acc[String(value)] = (acc[String(value)] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};

/**
 * 利用可能日数が少ない利用者を抽出
 */
export const getUrgentRemainingDaysUsers = (
  users: IUserMaster[],
  usageCounts: Record<string, number>, // ユーザーID -> 今月使用日数のマッピング
  threshold: number = 5
): Array<{
  user: IUserMaster;
  remainingDays: number;
  alertType: "success" | "warning" | "error";
}> => {
  return users
    .filter(user => user.UsageStatus === '利用中' && user.GrantedDaysPerMonth)
    .map(user => {
      const usedDays = usageCounts[user.UserID] || 0;
      const grantedDays = parseInt(user.GrantedDaysPerMonth || "0", 10);
      const remainingDays = calculateRemainingDays(user, grantedDays, usedDays);
      const alertType = getRemainingDaysAlert(remainingDays);

      return {
        user,
        remainingDays,
        alertType,
      };
    })
    .filter(item => item.remainingDays <= threshold)
    .sort((a, b) => a.remainingDays - b.remainingDays);
};

/**
 * 受給者証期限が近い利用者を抽出
 */
export const getExpiringCertUsers = (
  users: IUserMaster[],
  dayThreshold: number = 60
): Array<{
  user: IUserMaster;
  status: "valid" | "warning" | "expired";
  daysUntilExpiry: number;
  message: string;
}> => {
  return users
    .filter(user => user.IsActive)
    .map(user => {
      const certStatus = getCertExpiryStatus(user);
      return {
        user,
        ...certStatus,
      };
    })
    .filter(item =>
      item.status === 'expired' ||
      (item.status === 'warning' && item.daysUntilExpiry <= dayThreshold)
    )
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
};

/**
 * 支給決定期間の更新が必要な利用者を抽出
 */
export const getRenewalRequiredUsers = (
  users: IUserMaster[]
): Array<{
  user: IUserMaster;
  isActive: boolean;
  daysRemaining: number;
  renewalRequired: boolean;
}> => {
  return users
    .filter(user => user.IsActive)
    .map(user => {
      const grantStatus = getGrantPeriodStatus(user);
      return {
        user,
        ...grantStatus,
      };
    })
    .filter(item => item.renewalRequired)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
};

/**
 * 利用者の月次利用統計を計算
 */
export const calculateMonthlyUsageStats = (
  user: IUserMaster,
  usedDays: number,
  _currentMonth: string = new Date().toISOString().slice(0, 7) // YYYY-MM
): {
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
  utilizationRate: number;
  alertType: "success" | "warning" | "error";
  isOverUsage: boolean;
} => {
  const grantedDays = parseInt(user.GrantedDaysPerMonth || "0", 10);
  const remainingDays = Math.max(0, grantedDays - usedDays);
  const utilizationRate = grantedDays > 0 ? Math.round((usedDays / grantedDays) * 100) : 0;
  const alertType = getRemainingDaysAlert(remainingDays);
  const isOverUsage = usedDays > grantedDays;

  return {
    grantedDays,
    usedDays,
    remainingDays,
    utilizationRate,
    alertType,
    isOverUsage,
  };
};

// 型安全性のための定数定義
export const USAGE_STATUS = {
  ACTIVE: '利用中',
  PENDING: '契約済・利用開始待ち',
  SUSPENDED: '利用休止中',
  TERMINATED: '契約終了',
} as const;

export const DISABILITY_SUPPORT_LEVELS = {
  NONE: 'none',
  LEVEL_1: '1',
  LEVEL_2: '2',
  LEVEL_3: '3',
  LEVEL_4: '4',
  LEVEL_5: '5',
  LEVEL_6: '6',
} as const;

export const TRANSPORT_ADDITION_TYPES = {
  BOTH: 'both',
  TO_ONLY: 'oneway-to',
  FROM_ONLY: 'oneway-from',
  NONE: 'none',
} as const;

export const MEAL_ADDITION_OPTIONS = {
  USE: 'use',
  NOT_USE: 'not-use',
} as const;

export const COPAY_PAYMENT_METHODS = {
  BANK: 'bank',
  CASH_OFFICE: 'cash-office',
  CASH_TRANSPORT: 'cash-transport',
} as const;

export type UsageStatusType = typeof USAGE_STATUS[keyof typeof USAGE_STATUS];
export type DisabilitySupportLevelType = typeof DISABILITY_SUPPORT_LEVELS[keyof typeof DISABILITY_SUPPORT_LEVELS];
export type TransportAdditionType = typeof TRANSPORT_ADDITION_TYPES[keyof typeof TRANSPORT_ADDITION_TYPES];
export type MealAdditionType = typeof MEAL_ADDITION_OPTIONS[keyof typeof MEAL_ADDITION_OPTIONS];
export type CopayPaymentMethodType = typeof COPAY_PAYMENT_METHODS[keyof typeof COPAY_PAYMENT_METHODS];