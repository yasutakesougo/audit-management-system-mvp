export type ObservationVitalsPayload = {
  temp?: number;
  pulse?: number;
  sys?: number;
  dia?: number;
  spo2?: number;
  weight?: number;
};

export type NurseQueueItemType = 'observation' | 'seizure';

type QueueSource = 'quicklog.seizure' | 'observation.form' | 'bp.panel';

type BaseQueueItem = {
  idempotencyKey: string;
  type: NurseQueueItemType;
  userId: string;
  memo: string;
  tags: string[];
  timestampUtc: string;
  localTz?: string;
  createdBy?: string;
  deviceId?: string;
  source: QueueSource;
  retryCount?: number;
  nextAttemptAt?: string;
  lastError?: string;
};

export type ObservationQueueItem = BaseQueueItem & {
  type: 'observation';
  vitals: ObservationVitalsPayload;
};

export type SeizureQueueItem = BaseQueueItem & {
  type: 'seizure';
  vitals?: undefined;
};

export type NurseQueueItem = ObservationQueueItem | SeizureQueueItem;

export const QUEUE_STORAGE_KEY = 'nurse.queue.v2';
export const QUEUE_MAX = 500;
export const QUEUE_WARN_THRESHOLD = 400;
export const BACKOFF_SECONDS = [2, 4, 8] as const;

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const safeParse = (raw: string | null): NurseQueueItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NurseQueueItem[]) : [];
  } catch {
    return [];
  }
};

const write = (items: NurseQueueItem[]) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage failures
  }
};

export const nowUtcIso = () => new Date(Date.now()).toISOString();

const cryptoRandomSuffix = () => Math.random().toString(36).slice(2, 6);

export const buildIdempotencyKey = (input: {
  userId: string;
  type: NurseQueueItemType;
  timestampUtc: string;
  clientUuid?: string;
}) => `${input.userId}:${input.type}:${input.timestampUtc}:${input.clientUuid ?? cryptoRandomSuffix()}`;

export const loadQueue = (): NurseQueueItem[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    return safeParse(storage.getItem(QUEUE_STORAGE_KEY));
  } catch {
    return [];
  }
};

export const saveQueue = (items: NurseQueueItem[]) => {
  write(items);
};

export const pushWithCap = (
  items: NurseQueueItem[],
  item: NurseQueueItem,
): { items: NurseQueueItem[]; warned: boolean; size: number } => {
  if (items.some((entry) => entry.idempotencyKey === item.idempotencyKey)) {
    return { items, warned: false, size: items.length };
  }
  const next = [...items, item];
  let warned = false;
  if (next.length > QUEUE_MAX) {
    next.shift();
    warned = true;
  } else if (next.length >= QUEUE_WARN_THRESHOLD) {
    warned = true;
  }
  return { items: next, warned, size: next.length };
};

export const queue = {
  all(): NurseQueueItem[] {
    return loadQueue();
  },
  add(item: NurseQueueItem) {
    const current = loadQueue();
    const { items, warned } = pushWithCap(current, item);
    saveQueue(items);
    return { warned, size: items.length };
  },
  replace(items: NurseQueueItem[]) {
    saveQueue(items);
  },
};
