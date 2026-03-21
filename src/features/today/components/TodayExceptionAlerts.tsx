import { BentoCard } from '@/components/ui/BentoGrid';
import type { UseTodayExceptionsResult } from '@/features/today/hooks/useTodayExceptions';
import { useExceptionPreferences } from '@/features/exceptions/hooks/useExceptionPreferences';
import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';

function SectionLabel({ emoji, text }: { emoji: string; text: string }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mb: 1.5,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'text.secondary',
        fontSize: '0.7rem',
      }}
    >
      {emoji} {text}
    </Typography>
  );
}

export type TodayExceptionAlertsProps = {
  exceptionsQueue?: UseTodayExceptionsResult;
};

export const TodayExceptionAlerts: React.FC<TodayExceptionAlertsProps> = ({
  exceptionsQueue,
}) => {
  const navigate = useNavigate();
  const pref = useExceptionPreferences();

  const handleSnooze = (stableId?: string) => {
    if (!stableId) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    pref.snooze(stableId, tomorrow.toISOString());
  };

  const handleDismiss = (stableId?: string) => {
    if (!stableId) return;
    pref.dismiss(stableId);
  };

  if (!exceptionsQueue || exceptionsQueue.isLoading) return null;
  if (!exceptionsQueue.heroItem && exceptionsQueue.queueItems.length === 0) return null;

  const criticalHeroItem =
    exceptionsQueue.heroItem?.priority === 'critical'
      ? exceptionsQueue.heroItem
      : null;

  const listItems = criticalHeroItem
    ? exceptionsQueue.queueItems
    : [exceptionsQueue.heroItem, ...exceptionsQueue.queueItems].filter(
        (item): item is NonNullable<typeof item> => Boolean(item),
      );

  return (
    <>
      {criticalHeroItem && (
        <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }}>
          <Alert
            severity="error"
            variant="filled"
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                {criticalHeroItem.stableId && (
                  <>
                    <Button color="inherit" size="small" onClick={() => handleSnooze(criticalHeroItem.stableId)}>
                      あとで
                    </Button>
                    <Button color="inherit" size="small" onClick={() => handleDismiss(criticalHeroItem.stableId)}>
                      今日は無視
                    </Button>
                  </>
                )}
                <Button
                  color="inherit"
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(criticalHeroItem.actionPath)}
                >
                  {criticalHeroItem.actionLabel ?? '対応'}
                </Button>
              </Box>
            }
          >
            <AlertTitle>司令塔からの緊急アクション</AlertTitle>
            {criticalHeroItem.title} — {criticalHeroItem.description}
          </Alert>
        </BentoCard>
      )}

      {listItems.length > 0 && (
        <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} variant="default">
          <SectionLabel emoji="⚠️" text="今日の要確認（司令塔）" />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {listItems.map((item) => (
              <Alert
                key={item.id}
                severity={item.priority === 'high' ? 'warning' : 'info'}
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {item.stableId && (
                      <>
                        <Button color="inherit" size="small" onClick={() => handleSnooze(item.stableId)}>
                          あとで
                        </Button>
                        <Button color="inherit" size="small" onClick={() => handleDismiss(item.stableId)}>
                          今日は無視
                        </Button>
                      </>
                    )}
                    <Button variant="outlined" size="small" onClick={() => navigate(item.actionPath)}>
                      {item.actionLabel ?? '対応'}
                    </Button>
                  </Box>
                }
              >
                {item.title}
              </Alert>
            ))}
          </Box>
        </BentoCard>
      )}
    </>
  );
};
