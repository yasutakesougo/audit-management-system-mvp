import { createContext, useContext } from 'react';
import { demoSchedulesPort } from './demoAdapter';
import { makeSharePointSchedulesPort } from './sharePointAdapter';
import { isDemoModeEnabled, skipSharePoint } from '@/lib/env';
import { isE2eForceSchedulesWrite } from '@/env';
import type { SchedulesPort } from './port';

// Demo mode or SharePoint disabled: use demo adapter
// Otherwise: use SharePoint adapter
const useSharePoint =
  import.meta.env.VITE_FEATURE_SCHEDULES === '1' && 
  !isDemoModeEnabled() && 
  !skipSharePoint() &&
  !isE2eForceSchedulesWrite;

const schedulesPort = useSharePoint
  ? makeSharePointSchedulesPort()
  : demoSchedulesPort;

const SchedulesPortContext = createContext<SchedulesPort>(schedulesPort);

export const SchedulesProvider = SchedulesPortContext.Provider;

export const useSchedulesPort = (): SchedulesPort => useContext(SchedulesPortContext);
