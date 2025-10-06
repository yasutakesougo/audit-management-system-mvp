import { isDevMode } from '@/lib/env';

export function isDevEnvironment(): boolean {
  return isDevMode();
}
