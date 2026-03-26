import { getDb, isFirestoreWriteAvailable } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type {
  KioskNavigationPayload,
  KioskTelemetryEventName,
} from './kioskNavigationTelemetry.types';

/**
 * キオスクモード関連のUX（1タップ導線・帰り道）利用実績をFirestore Telemetryコレクションに記録する。
 *
 * @param eventName 発火するUXイベントの種類
 * @param payload イベントに付与するメタデータ（遷移先・発火箇所など）
 */
export function recordKioskTelemetry(
  eventName: KioskTelemetryEventName,
  payload: KioskNavigationPayload
): void {
  if (!isFirestoreWriteAvailable()) {
    return;
  }

  try {
    const docData = {
      ...payload,
      event: eventName,
      type: 'kiosk_ux_event',
      ts: serverTimestamp(),
      clientTs: Date.now(),
    };

    // 非同期で送信（成否に関わらずメインスレッドをブロックしない）
    addDoc(collection(getDb(), 'telemetry'), docData).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[kiosk-telemetry] write failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[kiosk-telemetry] skipped (db not ready)', err);
  }
}
