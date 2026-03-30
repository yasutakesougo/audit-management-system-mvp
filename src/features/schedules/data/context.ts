import { createContext, useContext } from 'react';
import { demoSchedulesPort } from './demoAdapter';
import type { SchedulesPort } from './port';

const schedulesPort = demoSchedulesPort;

const SchedulesPortContext = createContext<SchedulesPort>(schedulesPort);

export const SchedulesProvider = SchedulesPortContext.Provider;

export const useSchedulesPort = (): SchedulesPort => useContext(SchedulesPortContext);
