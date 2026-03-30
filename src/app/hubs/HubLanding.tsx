import { useUserAuthz } from '@/auth/useUserAuthz';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HUB_DEFINITIONS, resolveHubVisibleEntries } from './hubDefinitions';
import { HUB_TELEMETRY_EVENTS, recordHubTelemetry } from './hubTelemetry';
import type { HubEntryCard, HubId } from './hubTypes';

type HubLandingProps = {
  hubId: HubId;
  children?: React.ReactNode;
  hideCardsWhenKiosk?: boolean;
};

const isKioskSearch = (search: string): boolean => {
  const value = new URLSearchParams(search).get('kiosk');
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
};

export const HubLanding: React.FC<HubLandingProps> = ({
  hubId,
  children,
  hideCardsWhenKiosk = false,
}) => {
  const definition = HUB_DEFINITIONS[hubId];
  const { role } = useUserAuthz();
  const navigate = useNavigate();
  const location = useLocation();
  const isKiosk = hideCardsWhenKiosk && isKioskSearch(location.search);

  const entries = useMemo(() => resolveHubVisibleEntries(hubId, role), [hubId, role]);
  const seenHubImpressionsRef = useRef<Set<string>>(new Set());
  const seenCardImpressionsRef = useRef<Set<string>>(new Set());

  const sectionedEntries = useMemo(
    () => ({
      primary: entries.primary.map((entry, index) => ({
        entry,
        section: 'primary' as const,
        position: index + 1,
      })),
      secondary: entries.secondary.map((entry, index) => ({
        entry,
        section: 'secondary' as const,
        position: index + 1,
      })),
      comingSoon: entries.comingSoon.map((entry, index) => ({
        entry,
        section: 'comingSoon' as const,
        position: index + 1,
      })),
    }),
    [entries],
  );

  const flatVisibleEntries = useMemo(
    () => [...sectionedEntries.primary, ...sectionedEntries.secondary, ...sectionedEntries.comingSoon],
    [sectionedEntries],
  );

  useEffect(() => {
    if (isKiosk) return;
    const visibilityKey = [
      hubId,
      role,
      flatVisibleEntries.map(({ entry, section, position }) => `${entry.id}:${section}:${position}`).join(','),
    ].join('|');
    if (seenHubImpressionsRef.current.has(visibilityKey)) {
      return;
    }
    seenHubImpressionsRef.current.add(visibilityKey);
    recordHubTelemetry({
      eventName: HUB_TELEMETRY_EVENTS.HUB_VIEWED,
      hubId,
      role,
      telemetryName: definition.telemetryName,
      pathname: location.pathname,
      search: location.search,
      section: 'hub',
      visibleEntryCount: flatVisibleEntries.length,
    });
  }, [definition.telemetryName, flatVisibleEntries, hubId, isKiosk, location.pathname, location.search, role]);

  useEffect(() => {
    if (isKiosk) return;
    for (const { entry, section, position } of flatVisibleEntries) {
      const key = [hubId, role, entry.id, section, position].join('|');
      if (seenCardImpressionsRef.current.has(key)) {
        continue;
      }
      seenCardImpressionsRef.current.add(key);
      recordHubTelemetry({
        eventName: HUB_TELEMETRY_EVENTS.CARD_VIEWED,
        hubId,
        role,
        telemetryName: definition.telemetryName,
        pathname: location.pathname,
        search: location.search,
        entryId: entry.id,
        section,
        position,
        targetUrl: entry.to,
      });
    }
  }, [definition.telemetryName, flatVisibleEntries, hubId, isKiosk, location.pathname, location.search, role]);

  const hasVisibleEntries =
    entries.primary.length > 0 || entries.secondary.length > 0 || entries.comingSoon.length > 0;

  const renderEntry = (
    entry: HubEntryCard,
    section: 'primary' | 'secondary' | 'comingSoon',
    position: number,
  ) => {
    const isComingSoon = entry.status === 'comingSoon' || !entry.to;
    const openLabel =
      entry.ctaLabel ??
      (entry.status === 'primary' ? definition.primaryCtaLabel : '開く');
    return (
      <Card
        key={entry.id}
        data-testid={`hub-entry-card-${entry.id}`}
        variant="outlined"
        sx={{
          borderRadius: 2,
          height: '100%',
          opacity: isComingSoon ? 0.72 : 1,
          borderColor: entry.status === 'primary' ? 'primary.main' : 'divider',
        }}
      >
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {entry.title}
            </Typography>
            <Stack direction="row" spacing={0.75}>
              {entry.badge ? <Chip label={entry.badge} size="small" /> : null}
              {entry.status === 'comingSoon' ? (
                <Chip label="Coming Soon" size="small" color="default" />
              ) : null}
              {entry.requiredRole ? (
                <Chip label={entry.requiredRole} size="small" variant="outlined" />
              ) : null}
            </Stack>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>
            {entry.description}
          </Typography>

          <Box sx={{ mt: 'auto', pt: 0.5 }}>
            <Stack direction="row" spacing={1}>
              <Button
                data-testid={`hub-entry-open-${entry.id}`}
                size="small"
                variant={entry.status === 'primary' ? 'contained' : 'outlined'}
                disabled={isComingSoon}
                onClick={() => {
                  recordHubTelemetry({
                    eventName: HUB_TELEMETRY_EVENTS.CARD_CLICKED,
                    hubId,
                    role,
                    telemetryName: definition.telemetryName,
                    pathname: location.pathname,
                    search: location.search,
                    entryId: entry.id,
                    section,
                    position,
                    targetUrl: entry.to,
                  });
                  if (entry.to) navigate(entry.to);
                }}
              >
                {openLabel}
              </Button>
              {entry.helpLink ? (
                <Button
                  data-testid={`hub-entry-help-${entry.id}`}
                  size="small"
                  variant="text"
                  component="a"
                  href={entry.helpLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    recordHubTelemetry({
                      eventName: HUB_TELEMETRY_EVENTS.HELP_LINK_CLICKED,
                      hubId,
                      role,
                      telemetryName: definition.telemetryName,
                      pathname: location.pathname,
                      search: location.search,
                      entryId: entry.id,
                      section,
                      position,
                      helpLink: entry.helpLink,
                    })
                  }
                >
                  ヘルプ
                </Button>
              ) : null}
            </Stack>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderSection = (
    section: 'primary' | 'secondary' | 'comingSoon',
    title: string,
    sectionEntries: Array<{
      entry: HubEntryCard;
      section: 'primary' | 'secondary' | 'comingSoon';
      position: number;
    }>,
  ) => {
    if (sectionEntries.length === 0) return null;
    return (
      <Box data-testid={`hub-landing-section-${section}-${hubId}`} sx={{ display: 'grid', gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.4, fontWeight: 700 }}>
          {title}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {sectionEntries.map(({ entry, position }) => renderEntry(entry, section, position))}
        </Box>
      </Box>
    );
  };

  return (
    <Box data-testid={`hub-landing-${hubId}`} sx={{ display: 'grid', gap: 2 }}>
      {!isKiosk && (
        <Box data-testid={`hub-landing-cards-${hubId}`} sx={{ display: 'grid', gap: 1 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {definition.title}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {definition.subtitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {definition.purpose}
          </Typography>
          {hasVisibleEntries ? (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {renderSection('primary', '主導線', sectionedEntries.primary)}
              {renderSection('secondary', '補助導線', sectionedEntries.secondary)}
              {renderSection('comingSoon', 'Coming Soon', sectionedEntries.comingSoon)}
            </Box>
          ) : (
            <Card
              variant="outlined"
              data-testid={`hub-landing-empty-${hubId}`}
              sx={{ borderRadius: 2, borderStyle: 'dashed' }}
            >
              <CardContent sx={{ display: 'grid', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {definition.emptyStateTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {definition.emptyStateDescription}
                </Typography>
                {definition.helpLink ? (
                  <Button
                    data-testid={`hub-empty-cta-${hubId}`}
                    size="small"
                    variant="text"
                    component="a"
                    href={definition.helpLink}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ justifyContent: 'flex-start', px: 0 }}
                    onClick={() => {
                      recordHubTelemetry({
                        eventName: HUB_TELEMETRY_EVENTS.EMPTY_STATE_CTA_CLICKED,
                        hubId,
                        role,
                        telemetryName: definition.telemetryName,
                        pathname: location.pathname,
                        search: location.search,
                        section: 'emptyState',
                        position: 1,
                        helpLink: definition.helpLink,
                      });
                      recordHubTelemetry({
                        eventName: HUB_TELEMETRY_EVENTS.HELP_LINK_CLICKED,
                        hubId,
                        role,
                        telemetryName: definition.telemetryName,
                        pathname: location.pathname,
                        search: location.search,
                        section: 'emptyState',
                        position: 1,
                        helpLink: definition.helpLink,
                      });
                    }}
                  >
                    ヘルプを開く
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}
        </Box>
      )}
      {children}
    </Box>
  );
};

export default HubLanding;
