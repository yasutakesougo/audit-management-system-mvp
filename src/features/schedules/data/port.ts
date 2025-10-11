export type SchedItem = {
  id: string;
  title: string;
  start: string;
  end: string;
};

export interface SchedulesPort {
  list(range: { from: string; to: string }): Promise<SchedItem[]>;
}
