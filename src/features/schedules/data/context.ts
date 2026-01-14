import { createContext, useContext } from 'react';
import { demoSchedulesPort } from './demoAdapter';
import type { SchedulesPort } from './port';

const SchedulesPortContext = createContext<SchedulesPort>(demoSchedulesPort);

export const SchedulesProvider = SchedulesPortContext.Provider;

export const useSchedulesPort = (): SchedulesPort => useContext(SchedulesPortContext);
