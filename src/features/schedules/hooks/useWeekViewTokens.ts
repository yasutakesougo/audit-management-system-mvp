/**
 * useWeekViewTokens.ts — Theme token computation hook extracted from WeekView.tsx
 *
 * Encapsulates MUI-theme-derived color tokens for service types used in the week view.
 * All color logic is isolated here so WeekViewContent stays focused on layout/rendering.
 */
import { useTheme } from '@mui/material/styles';
import { useCallback, useMemo } from 'react';
import { SERVICE_TYPE_COLOR, type ServiceTypeColor, type ServiceTypeKey } from '../serviceTypeMetadata';

export type ServiceTokens = { bg: string; border: string; accent: string };

export function useWeekViewTokens(): {
  getServiceTokens: (key: ServiceTypeKey) => ServiceTokens;
} {
  const theme = useTheme();

  const baseServiceTokens = useMemo<Record<ServiceTypeKey, ServiceTokens>>(() => {
    const buildTokens = (color: ServiceTypeColor): ServiceTokens => {
      if (color === 'default') {
        return {
          bg: theme.palette.grey[50],
          border: theme.palette.grey[300],
          accent: theme.palette.grey[600],
        };
      }
      const paletteEntry = theme.palette[color];
      return {
        bg: paletteEntry?.light ?? theme.palette.grey[50],
        border: paletteEntry?.main ?? theme.palette.grey[300],
        accent: paletteEntry?.dark ?? theme.palette.grey[700],
      };
    };

    return (Object.keys(SERVICE_TYPE_COLOR) as ServiceTypeKey[]).reduce<Record<ServiceTypeKey, ServiceTokens>>((map, key) => {
      map[key] = buildTokens(SERVICE_TYPE_COLOR[key]);
      return map;
    }, {} as Record<ServiceTypeKey, ServiceTokens>);
  }, [theme]);

  const serviceTypeColors = (theme as unknown as {
    serviceTypeColors?: Record<string, ServiceTokens>;
  }).serviceTypeColors;

  const getServiceTokens = useCallback(
    (key: ServiceTypeKey): ServiceTokens => {
      const override = serviceTypeColors?.[key];
      if (override) return override;
      return baseServiceTokens[key];
    },
    [baseServiceTokens, serviceTypeColors],
  );

  return { getServiceTokens };
}
