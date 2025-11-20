// MonthlyUsageDashboardCard.tsx
import { Box, Card, CardContent, CardHeader, Chip, Divider, Typography } from "@mui/material";
import type { IUserMaster } from "./types";
import {
    calculateRemainingDays,
    getCertExpiryStatus,
    getGrantPeriodStatus,
    getRemainingDaysAlert,
} from "./userMasterDashboardUtils";

type MonthlyUsageDashboardCardProps = {
  user: IUserMaster;
  grantedDays: number; // 契約支給量（日数／月）
  usedDays: number;    // 今月すでに利用した日数（支援記録から計算して渡す）
};

export function MonthlyUsageDashboardCard({
  user,
  grantedDays,
  usedDays,
}: MonthlyUsageDashboardCardProps) {
  const remainingDays = calculateRemainingDays(user, grantedDays, usedDays);
  const remainingAlert = getRemainingDaysAlert(remainingDays);
  const certStatus = getCertExpiryStatus(user);
  const grantStatus = getGrantPeriodStatus(user);

  const usageRate =
    grantedDays > 0 ? Math.round((usedDays / grantedDays) * 100) : 0;

  const alertColorMap: Record<"success" | "warning" | "error", "default" | "success" | "warning" | "error"> = {
    success: "success",
    warning: "warning",
    error: "error",
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardHeader
        title={user.FullName}
        subheader={user.UserID}
        sx={{ pb: 0.5 }}
      />

      <CardContent sx={{ pt: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {/* 利用状況 */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            今月の利用状況
          </Typography>
          <Chip
            label={`${usedDays}/${grantedDays}日 (${usageRate}%)`}
            size="small"
            color={alertColorMap[remainingAlert]}
            variant="outlined"
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          残り利用可能日数：{remainingDays}日
        </Typography>

        <Divider sx={{ my: 1 }} />

        {/* 受給者証有効期限 */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            受給者証有効期限
          </Typography>
          <Chip
            label={certStatus.message}
            size="small"
            color={
              certStatus.status === "valid"
                ? "success"
                : certStatus.status === "warning"
                ? "warning"
                : "error"
            }
            variant="outlined"
          />
        </Box>

        {/* 支給決定期間 */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            支給決定期間
          </Typography>
          <Chip
            label={
              grantStatus.isActive
                ? `残り${grantStatus.daysRemaining}日`
                : "有効期間外／未登録"
            }
            size="small"
            color={grantStatus.renewalRequired ? "warning" : "default"}
            variant="outlined"
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default MonthlyUsageDashboardCard;