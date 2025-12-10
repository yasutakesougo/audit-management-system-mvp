// UsageStatusDashboard.tsx
import { Box, Typography } from "@mui/material";
import MonthlyUsageDashboardCard from "./MonthlyUsageDashboardCard.v2";
import type { IUserMaster } from "./types";

type UsageStatusDashboardProps = {
  users: IUserMaster[];
  usageMap: Record<
    string,
    {
      grantedDays: number;
      usedDays: number;
    }
  >;
};

export function UsageStatusDashboard({ users, usageMap }: UsageStatusDashboardProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="h6" gutterBottom>
          今月の利用状況ダッシュボード
        </Typography>
        <Typography variant="body2" color="text.secondary">
          契約支給量・受給者証有効期限・支給決定期間をまとめて確認できます。
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        {users.map((user) => {
          const usage = usageMap[user.UserID] ?? {
            grantedDays: parseInt(user.GrantedDaysPerMonth || "0", 10),
            usedDays: 0,
          };

          return (
            <Box key={user.UserID} sx={{ flex: "1 1 280px", maxWidth: 360 }}>
              <MonthlyUsageDashboardCard
                user={user}
                grantedDays={usage.grantedDays}
                usedDays={usage.usedDays}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default UsageStatusDashboard;