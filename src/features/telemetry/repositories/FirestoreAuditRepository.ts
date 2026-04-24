import { 
  addDoc, 
  collection, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { getDb, isFirestoreWriteAvailable } from '@/infra/firestore/client';
import { AuditLogEntry } from '@/lib/telemetry/auditLogger';
import { AuditRepository } from './AuditRepository';

/**
 * FirestoreAuditRepository
 * 監査ログを Firestore に保存する具体的な実装。
 */
export class FirestoreAuditRepository implements AuditRepository {
  async save(entry: AuditLogEntry): Promise<string | undefined> {
    if (!isFirestoreWriteAvailable()) return undefined;

    try {
      const db = getDb();
      const col = collection(db, 'orchestration_audits');
      
      const docRef = await addDoc(col, {
        action: entry.action,
        actor: entry.actor,
        targetId: String((entry.targetId as { id?: string | number } | undefined)?.id ?? entry.targetId ?? 'UNKNOWN'),
        status: entry.status,
        governanceStatus: entry.governanceStatus,
        durationMs: entry.durationMs,
        metadata: entry.metadata,
        error: entry.error,
        createdAt: serverTimestamp(),
        ts: serverTimestamp(), // Dashboard 互換性
        type: `audit:${entry.action}`, // Dashboard 互換性
      });

      return docRef.id;
    } catch (e) {
      console.warn('[AuditRepository] Firestore save failed:', e);
      return undefined;
    }
  }

  async resolve(args: {
    firestoreId: string;
    governanceStatus: import('@/lib/telemetry/auditLogger').AuditActionStatus;
    resolution: NonNullable<AuditLogEntry['resolution']>;
  }): Promise<void> {
    if (!isFirestoreWriteAvailable()) return;

    try {
      const db = getDb();
      const docRef = doc(db, 'orchestration_audits', args.firestoreId);
      
      await updateDoc(docRef, {
        governanceStatus: args.governanceStatus,
        resolution: {
          ...args.resolution,
          resolvedAt: serverTimestamp(),
        }
      });
    } catch (e) {
      console.warn('[AuditRepository] Firestore resolve failed:', e);
    }
  }
}

/**
 * シングルトンインスタンスの提供
 */
export const auditRepository = new FirestoreAuditRepository();
