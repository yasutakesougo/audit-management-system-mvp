import { createContext, useContext } from 'react';
import type { SchedulesPort } from './port';
import { demoSchedulesPort } from './demoAdapter';

const SchedulesPortContext = createContext<SchedulesPort>(demoSchedulesPort);

export const SchedulesProvider = SchedulesPortContext.Provider;

export const useSchedulesPort = (): SchedulesPort => useContext(SchedulesPortContext);
