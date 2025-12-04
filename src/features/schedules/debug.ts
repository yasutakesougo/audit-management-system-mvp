import { getAppConfig, readBool } from '@/lib/env';

export const SCHEDULES_DEBUG = getAppConfig().isDev && readBool('VITE_SCHEDULES_DEBUG', false);
