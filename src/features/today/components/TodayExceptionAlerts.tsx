import { BentoCard } from '@/components/ui/BentoGrid';
import type { Role } from '@/auth/roles';
import type { UseTodayExceptionsResult } from '@/features/today/hooks/useTodayExceptions';
import { useExceptionPreferences } from '@/features/exceptions/hooks/useExceptionPreferences';
import { buildExceptionCenterDeepLinkPath } from '@/features/exceptions/domain/exceptionCenterDeepLink';
import { Alert, AlertTitle, Box, Button, Chip, Typography, List, ListItem, ListItemIcon, ListItemText, IconButton } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { EXCEPTION_CATEGORIES } from '@/features/exceptions/domain/exceptionLogic';
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
  audience?: Role;
};

export const TodayExceptionAlerts: React.FC<TodayExceptionAlertsProps> = ({
  exceptionsQueue,
  audience = 'viewer',
}) => {
  const navigate = useNavigate();
  const pref = useExceptionPreferences();
  const isAdminAudience = audience === 'admin';

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

  const handleAcknowledge = (stableId?: string) => {
    if (!stableId) return;
    pref.acknowledge(stableId, { acknowledgedAt: new Date().toISOString() });
  };

  const handleUnacknowledge = (stableId?: string) => {
    if (!stableId) return;
    pref.unacknowledge(stableId);
  };

  const handleResolve = (stableId?: string) => {
    if (!stableId) return;
    pref.resolve(stableId, {
      resolvedAt: new Date().toISOString(),
      resolutionMode: 'manual',
    });
  };

  if (!exceptionsQueue || exceptionsQueue.isLoading) return null;
  if (!exceptionsQueue.heroItem && exceptionsQueue.queueItems.length === 0) return null;

  const actionableItems = [exceptionsQueue.heroItem, ...exceptionsQueue.queueItems].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const criticalCount = actionableItems.filter((item) => item.priority === 'critical').length;

  const frontlineActionPath =
    actionableItems.find((item) => !item.actionPath.startsWith('/admin/') && !item.actionPath.startsWith('/analysis'))?.actionPath
    ?? '/daily/table';

  if (!isAdminAudience) {
    const displayItems = actionableItems.slice(0, 3);
    const hasMore = actionableItems.length > 3;

    return (
      <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }} variant="default" data-testid="today-exception-alerts-compact">
        <SectionLabel emoji="⚠️" text="至急の対応が必要です" />
        <Alert
          severity={criticalCount > 0 ? 'warning' : 'info'}
          data-testid="today-exception-alert-compact-summary"
          sx={{ mb: 1.5 }}
        >
          <AlertTitle>要対応 {actionableItems.length}件</AlertTitle>
          <Box sx={{ mt: 1 }}>
            <List dense disablePadding>
              {displayItems.map((item) => (
                <ListItem
                  key={item.id}
                  disableGutters
                  sx={{ py: 0.25 }}
                  secondaryAction={
                    <IconButton size="small" onClick={() => navigate(item.actionPath)}>
                      <OpenInNewIcon fontSize="inherit" />
                    </IconButton>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <Box sx={{ fontSize: '1rem' }}>
                      {EXCEPTION_CATEGORIES[item.kind]?.icon ?? '•'}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { fontWeight: 500, fontSize: '0.8rem' }
                    }}
                  />
                </ListItem>
              ))}
              {hasMore && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.7 }}>
                  他 {actionableItems.length - 3} 件の項目があります
                </Typography>
              )}
            </List>
          </Box>
        </Alert>
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(frontlineActionPath)}
            data-testid="today-exception-alert-compact-action"
            fullWidth
          >
            全件を確認・対応する
          </Button>
        </Box>
      </BentoCard>
    );
  }


  const criticalHeroItem =
    exceptionsQueue.heroItem?.priority === 'critical'
      ? exceptionsQueue.heroItem
      : null;

  const listItems = criticalHeroItem
    ? exceptionsQueue.queueItems
    : [exceptionsQueue.heroItem, ...exceptionsQueue.queueItems].filter(
        (item): item is NonNullable<typeof item> => Boolean(item),
      );
  const topPriorityItemId = exceptionsQueue.topPriorityItem?.id;
  const handlePriorityChipClick = (item: NonNullable<typeof listItems[number]>) => {
    navigate(buildExceptionCenterDeepLinkPath({
      category: item.kind,
      userId: item.userId ?? null,
      source: 'today',
    }));
  };

  return (
    <>
      {criticalHeroItem && (
        <BentoCard colSpan={{ xs: 1, sm: 2, md: 4 }}>
          <Alert
            severity="error"
            variant="filled"
            action={
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {criticalHeroItem.stableId && (
                  <>
                    {criticalHeroItem.acknowledgement ? (
                      <>
                        <Button color="inherit" size="small" onClick={() => handleResolve(criticalHeroItem.stableId)}>
                          対応済みにする
                        </Button>
                        <Button color="inherit" size="small" onClick={() => handleUnacknowledge(criticalHeroItem.stableId)}>
                          対応中を解除
                        </Button>
                      </>
                    ) : (
                      <Button color="inherit" size="small" onClick={() => handleAcknowledge(criticalHeroItem.stableId)}>
                        対応中にする
                      </Button>
                    )}
                    <Button color="inherit" size="small" onClick={() => handleSnooze(criticalHeroItem.stableId)}>
                      あとで
                    </Button>
                    <Button color="inherit" size="small" onClick={() => handleDismiss(criticalHeroItem.stableId)}>
                      今日は無視
                    </Button>
                  </>
                )}
                {criticalHeroItem.secondaryActionPath && (
                  <Button color="inherit" size="small" onClick={() => navigate(criticalHeroItem.secondaryActionPath!)}>
                    {criticalHeroItem.secondaryActionLabel ?? '詳細'}
                  </Button>
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
                data-testid={`today-exception-alert-${item.id}`}
                action={
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {item.stableId && (
                      <>
                        {item.acknowledgement ? (
                          <>
                            <Button color="inherit" size="small" onClick={() => handleResolve(item.stableId)}>
                              対応済みにする
                            </Button>
                            <Button color="inherit" size="small" onClick={() => handleUnacknowledge(item.stableId)}>
                              対応中を解除
                            </Button>
                          </>
                        ) : (
                          <Button color="inherit" size="small" onClick={() => handleAcknowledge(item.stableId)}>
                            対応中にする
                          </Button>
                        )}
                        <Button color="inherit" size="small" onClick={() => handleSnooze(item.stableId)}>
                          あとで
                        </Button>
                        <Button color="inherit" size="small" onClick={() => handleDismiss(item.stableId)}>
                          今日は無視
                        </Button>
                      </>
                    )}
                    {item.secondaryActionPath && (
                      <Button variant="text" size="small" onClick={() => navigate(item.secondaryActionPath!)}>
                        {item.secondaryActionLabel ?? '詳細'}
                      </Button>
                    )}
                    <Button variant="outlined" size="small" onClick={() => navigate(item.actionPath)}>
                      {item.actionLabel ?? '対応'}
                    </Button>
                  </Box>
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {item.acknowledgement && (
                    <Chip
                      label="対応中"
                      size="small"
                      color="info"
                      variant="outlined"
                      data-testid={`today-exception-acknowledged-chip-${item.id}`}
                    />
                  )}
                  {topPriorityItemId === item.id && (
                    <Chip
                      label="司令塔優先"
                      size="small"
                      color="warning"
                      variant="outlined"
                      data-testid={`today-exception-priority-chip-${item.id}`}
                      onClick={() => handlePriorityChipClick(item)}
                      sx={{ cursor: 'pointer' }}
                    />
                  )}
                  <span>{item.title}</span>
                </Box>
              </Alert>
            ))}
          </Box>
        </BentoCard>
      )}
    </>
  );
};
