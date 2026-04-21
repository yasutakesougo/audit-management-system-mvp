/**
 * kioskTelemetry — Kiosk モード固有のテレメトリ機能の集約
 */
import { recordKioskTelemetry } from './recordKioskTelemetry';
import { KIOSK_TELEMETRY_EVENTS } from './kioskNavigationTelemetry.types';

export { recordKioskTelemetry, KIOSK_TELEMETRY_EVENTS };

/**
 * キオスクモードのセッション一意識別子を生成する。
 * ブラウザリロードまで維持される ID として useRef 等で保持することを想定。
 */
export function createKioskSessionId(): string {
  const ts = new Date().getTime();
  const rand = Math.random().toString(36).substring(2, 9);
  return `kiosk-${ts}-${rand}`;
}
