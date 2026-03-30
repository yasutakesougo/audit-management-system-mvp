/**
 * @fileoverview 通知配送を制御するオーケストレーター Hook
 */
import { useEffect, useCallback, useRef } from 'react';
import type { EscalatedException } from './useEscalationEvaluation';
import { buildEscalationEnvelope, mapToTeamsPayload, mapToInAppPayload } from '../domain/notificationPayloadBuilder';
import { mockNotificationAdapter } from '../infra/notificationChannelAdapter';
import { createAuditLogFromDelivery, createAuditLogFromSuppression } from '../domain/notificationAuditLogger';
import { localNotificationAuditRepository } from '../infra/notificationAuditRepository';

export function useNotificationDispatcher(activeEscalations: EscalatedException[]) {
  // すでに配送済みの例外IDを追跡し、同一セッションでの重複送信を最小化
  const sentCacheRef = useRef<Set<string>>(new Set());

  const dispatchNotifications = useCallback(async () => {
    const unsent = activeEscalations.filter(e => !sentCacheRef.current.has(e.item.id));
    if (unsent.length === 0) return;

    for (const escalated of unsent) {
      const { item, decision } = escalated;
      
      // 1. 封筒の構築
      const envelope = buildEscalationEnvelope(decision, item);

      // 判定時点で抑制されている場合の記録
      if (decision.isSuppressed) {
        const skipLog = createAuditLogFromSuppression(envelope);
        await localNotificationAuditRepository.save(skipLog);
        continue;
      }

      // キャッシュに即座に追加 (重複送信防止の楽観的ロック)
      sentCacheRef.current.add(item.id);

      // 2. 各チャネルへの配送実行
      for (const channel of envelope.channels) {
        if (channel === 'teams') {
          const payload = mapToTeamsPayload(envelope);
          const result = await mockNotificationAdapter.sendTeamsAlert(payload);
          const log = createAuditLogFromDelivery(envelope, result);
          await localNotificationAuditRepository.save(log);
        } else if (channel === 'in-app') {
          const payload = mapToInAppPayload(envelope);
          const result = await mockNotificationAdapter.sendInAppAlert(payload);
          const log = createAuditLogFromDelivery(envelope, result);
          await localNotificationAuditRepository.save(log);
        }
      }
    }
  }, [activeEscalations]);

  // 緊急度の高い例外が追加された際に配送
  useEffect(() => {
    if (activeEscalations.length > 0) {
      void dispatchNotifications();
    }
  }, [activeEscalations, dispatchNotifications]);

  return {
    dispatchNotifications,
    historyCount: sentCacheRef.current.size
  };
}
