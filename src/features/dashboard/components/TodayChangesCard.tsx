/**
 * TodayChanges Card & helpers
 * Extracted from DashboardPage.tsx to reduce file size.
 *
 * 責務:
 * - 利用者・職員の当日変更をまとめて表示
 * - 生活支援（SS / 一時ケア）の件数を俯瞰表示
 * - 入力 UI なし（完全に Reflect）
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ===== Types =====

export type ChangeItem = {
  id: string;
  text: string;
  tone?: 'info' | 'warn';
};

/** 生活支援（SS / 一時ケア）のサマリー */
export type LifeSupportSummary = {
  shortStayCount: number;
  temporaryCareCount: number;
};

export type TodayChanges = {
  userChanges: ChangeItem[];
  staffChanges: ChangeItem[];
};

// ===== ChangeSection =====

export function ChangeSection(props: { title: string; items: ChangeItem[] }) {
  const { title, items } = props;

  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" sx={{ opacity: 0.85 }} fontWeight={700}>
        {title}
      </Typography>

      <Stack spacing={0.5}>
        {items.map((it) => (
          <Alert
            key={it.id}
            severity={it.tone === 'warn' ? 'warning' : 'info'}
            variant="outlined"
            sx={{
              py: 0.25,
              '& .MuiAlert-message': { py: 0 },
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">{it.text}</Typography>
          </Alert>
        ))}
      </Stack>
    </Stack>
  );
}

// ===== TodayChangesCard =====

export function TodayChangesCard(props: {
  dateLabel: string;
  changes: TodayChanges;
  lifeSupport: LifeSupportSummary;
}) {
  const { dateLabel, changes, lifeSupport } = props;

  const hasAny = changes.userChanges.length > 0 || changes.staffChanges.length > 0;
  const hasLifeSupport = lifeSupport.shortStayCount > 0 || lifeSupport.temporaryCareCount > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ pb: 0.5 }}>
        <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.8 }}>
          本日の確認
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          {dateLabel}
        </Typography>
      </Stack>

      <Box
        sx={{
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 上段：本日の変更（自然高さ、スクロールなし） */}
        <Box sx={{ flex: '0 0 auto' }}>
          <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.75, display: 'block', mb: 0.5 }}>
            変更
          </Typography>
          {hasAny ? (
            <Stack spacing={0.5}>
              <ChangeSection title="利用者" items={changes.userChanges} />
              <ChangeSection title="職員" items={changes.staffChanges} />
            </Stack>
          ) : (
            <Box sx={{ userSelect: 'none' }}>
              <Typography variant="body2" noWrap sx={{ opacity: 0.85 }}>
                利用者：なし
              </Typography>
              <Typography variant="body2" noWrap sx={{ opacity: 0.85 }}>
                職員：なし
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ opacity: 0.3, flexShrink: 0 }} />

        {/* 下段：生活支援情報（件数ベース） */}
        <Box
          sx={{
            flex: '1 0 auto',
            minHeight: 0,
            overflow: 'hidden',
            pb: 1,
          }}
        >
          <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.75, display: 'block', mb: 0.5 }}>
            生活支援
          </Typography>
          {hasLifeSupport ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {lifeSupport.shortStayCount > 0 && (
                <Chip
                  size="small"
                  label={`SS ${lifeSupport.shortStayCount}件`}
                  color="info"
                  variant="outlined"
                  data-testid="life-support-ss"
                />
              )}
              {lifeSupport.temporaryCareCount > 0 && (
                <Chip
                  size="small"
                  label={`一時ケア ${lifeSupport.temporaryCareCount}件`}
                  color="info"
                  variant="outlined"
                  data-testid="life-support-temp"
                />
              )}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              対応なし（✓確認済み）
            </Typography>
          )}
        </Box>

        <span style={{ position: 'absolute', left: -9999, top: -9999 }}>
          本日の確認情報：変更なし、生活支援対応なし
        </span>
      </Box>
    </Box>
  );
}
