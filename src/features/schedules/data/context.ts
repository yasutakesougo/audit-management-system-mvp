import { createContext, useContext } from 'react';
import { demoSchedulesPort } from './demoAdapter';
import { makeSharePointSchedulesPort } from './sharePointAdapter';
import type { SchedulesPort } from './port';

const useSharePoint =
  import.meta.env.VITE_FEATURE_SCHEDULES === '1';

const schedulesPort = useSharePoint
  ? makeSharePointSchedulesPort()
  : demoSchedulesPort;

const SchedulesPortContext = createContext<SchedulesPort>(schedulesPort);

export const SchedulesProvider = SchedulesPortContext.Provider;

export const useSchedulesPort = (): SchedulesPort => useContext(SchedulesPortContext);
