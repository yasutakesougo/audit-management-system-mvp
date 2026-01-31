export type DailyOpsTargetType = 'User' | 'Staff' | 'Facility' | 'Vehicle';

export type DailyOpsKind =
  | 'EarlyLeave'
  | 'Late'
  | 'Absent'
  | 'PickupChange'
  | 'Visitor'
  | 'Meeting'
  | 'Other';

export type DailyOpsStatus = 'Active' | 'Resolved';
export type DailyOpsSource = 'Phone' | 'Note' | 'InPerson' | 'Other';

export type DailyOpsSignal = {
  id: number; // SharePoint item Id
  title: string; // Title
  date: string; // yyyy-mm-dd (date only)
  targetType: DailyOpsTargetType;
  targetId: string;
  kind: DailyOpsKind;
  time?: string; // '11:00' など
  summary?: string;
  status: DailyOpsStatus;
  source: DailyOpsSource;

  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type UpsertDailyOpsSignalInput = Omit<
  DailyOpsSignal,
  'id' | 'title' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
> & {
  title?: string;
};

export type DailyOpsSignalsPort = {
  listByDate: (date: string, opts?: { status?: DailyOpsStatus }) => Promise<DailyOpsSignal[]>;
  upsert: (input: UpsertDailyOpsSignalInput) => Promise<DailyOpsSignal>;
  setStatus: (itemId: number, status: DailyOpsStatus) => Promise<void>;
};
