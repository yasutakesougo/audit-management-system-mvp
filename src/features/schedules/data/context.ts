import { isE2E, isE2eForceSchedulesWrite } from '@/env';
import { isDemoModeEnabled, isSchedulesFeatureEnabled, shouldSkipSharePoint } from '@/lib/env';
import { createContext, useContext } from 'react';
import { demoSchedulesPort } from './demoAdapter';
import type { SchedulesPort } from './port';
import { makeSharePointSchedulesPort } from './sharePointAdapter';

// Demo mode or SharePoint disabled: use demo adapter
// Otherwise: use SharePoint adapter
const useSharePoint =
  isSchedulesFeatureEnabled() &&
  !isDemoModeEnabled() &&
  (!shouldSkipSharePoint() || isE2E) &&
  !isE2eForceSchedulesWrite;

const schedulesPort = useSharePoint
  ? makeSharePointSchedulesPort()
  : demoSchedulesPort;

const SchedulesPortContext = createContext<SchedulesPort>(schedulesPort);

export const SchedulesProvider = SchedulesPortContext.Provider;

export const useSchedulesPort = (): SchedulesPort => useContext(SchedulesPortContext);
