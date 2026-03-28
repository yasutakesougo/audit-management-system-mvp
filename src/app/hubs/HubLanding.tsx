import { useUserAuthz } from '@/auth/useUserAuthz';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HUB_DEFINITIONS, resolveHubVisibleEntries } from './hubDefinitions';
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
  const hasVisibleEntries =
    entries.primary.length > 0 || entries.secondary.length > 0 || entries.comingSoon.length > 0;

  const renderEntry = (entry: HubEntryCard) => {
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
    sectionEntries: HubEntryCard[],
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
          {sectionEntries.map(renderEntry)}
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
              {renderSection('primary', '主導線', entries.primary)}
              {renderSection('secondary', '補助導線', entries.secondary)}
              {renderSection('comingSoon', 'Coming Soon', entries.comingSoon)}
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
                    size="small"
                    variant="text"
                    component="a"
                    href={definition.helpLink}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ justifyContent: 'flex-start', px: 0 }}
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
