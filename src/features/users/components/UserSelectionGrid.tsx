/**
 * UserSelectionGrid — Generic User Selection Component
 *
 * Displays a grid of user cards and calls onSelect callback.
 * Reused in ISP Editor, Support Procedure Management, etc.
 * Now using unified Japanese sorting logic.
 */
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { compareUsersByJapaneseOrder } from '@/lib/i18n/japaneseCollator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSelectionItem {
  Id: number;
  UserID: string;
  FullName: string;
  Furigana?: string | null;
  FullNameKana?: string | null;
  IsHighIntensitySupportTarget?: boolean | null;
}

export interface UserSelectionGridProps {
  /** List of users to display */
  users: UserSelectionItem[];
  /** Callback when card is selected (returns UserID) */
  onSelect: (userCode: string) => void;
  /** Grid title (optional) */
  title?: string;
  /** Grid subtitle (optional) */
  subtitle?: string;
  /** Whether to prioritize High Intensity Support Targets (default: true) */
  prioritizeIBD?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UserSelectionGrid: React.FC<UserSelectionGridProps> = ({
  users,
  onSelect,
  title = '対象利用者を選択してください',
  subtitle,
  prioritizeIBD = true,
}) => {
  // Sort by High Intensity Support Target first, then by common Japanese order
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (prioritizeIBD) {
        const aIBD = a.IsHighIntensitySupportTarget ? 1 : 0;
        const bIBD = b.IsHighIntensitySupportTarget ? 1 : 0;
        if (aIBD !== bIBD) return bIBD - aIBD;
      }
      return compareUsersByJapaneseOrder(a, b);
    });
  }, [users, prioritizeIBD]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {subtitle}
        </Typography>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {sortedUsers.map((user) => {
          const isIBD = Boolean(user.IsHighIntensitySupportTarget);
          return (
            <Card
              key={user.Id}
              variant="outlined"
              sx={{
                borderRadius: 2,
                borderColor: isIBD ? 'warning.main' : undefined,
                borderWidth: isIBD ? 2 : 1,
              }}
            >
              <CardActionArea
                onClick={() => onSelect(user.UserID)}
                sx={{ p: 2 }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <PersonIcon
                    sx={{
                      fontSize: 48,
                      color: isIBD ? 'warning.main' : 'primary.main',
                      mb: 1,
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {user.FullName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 1, flexWrap: 'wrap' }}>
                    <Chip label={user.UserID} size="small" variant="outlined" />
                    {isIBD && (
                      <Chip
                        icon={<StarIcon />}
                        label="行動分析対象"
                        size="small"
                        color="warning"
                        variant="filled"
                      />
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
      {users.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            利用者が登録されていません。
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default UserSelectionGrid;
