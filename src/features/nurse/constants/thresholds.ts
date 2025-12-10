export type RangeThreshold = {
  min: number;
  max: number;
  warn: number;
  danger?: number;
};

export type TupleThreshold = {
  min: number;
  max: number;
  warn: [number, number];
  warnLow?: number;
  warnHigh?: number;
};

export type WeightThreshold = {
  min: number;
  max: number;
  deltaWarn: number;
  deltaDanger: number;
};

export type VitalThresholds = {
  temp: RangeThreshold & { danger: number };
  pulse: TupleThreshold;
  spo2: RangeThreshold & { danger: number };
  systolic: TupleThreshold;
  diastolic: TupleThreshold;
  weight: WeightThreshold;
};

export const thresholds: VitalThresholds = {
  temp: { min: 34, max: 42.5, warn: 37.5, danger: 38 },
  pulse: { min: 30, max: 200, warn: [50, 110], warnLow: 50, warnHigh: 110 },
  spo2: { min: 70, max: 100, warn: 93, danger: 92 },
  systolic: { min: 60, max: 220, warn: [90, 140], warnLow: 90, warnHigh: 140 },
  diastolic: { min: 30, max: 140, warn: [50, 90], warnLow: 50, warnHigh: 90 },
  weight: { min: 20, max: 200, deltaWarn: 1.0, deltaDanger: 2.0 },
} as const;
