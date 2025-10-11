import type { SchedulesPort, SchedItem } from './port';

const formatISO = (date: Date): string => date.toISOString();
const addHours = (date: Date, hours: number): Date => new Date(date.getTime() + hours * 60 * 60 * 1000);

const base = new Date();
base.setSeconds(0, 0);

const demoItems: SchedItem[] = [
  {
    id: 'demo-visit-morning',
    title: '訪問介護（午前）',
    start: formatISO(base),
    end: formatISO(addHours(base, 2)),
  },
  {
    id: 'demo-meeting',
    title: 'ケース会議',
    start: formatISO(addHours(base, 3)),
    end: formatISO(addHours(base, 4)),
  },
  {
    id: 'demo-visit-afternoon',
    title: '訪問介護（午後）',
    start: formatISO(addHours(base, 6)),
    end: formatISO(addHours(base, 8)),
  },
];

const withinRange = ({ start, end }: SchedItem, range: { from: string; to: string }) => {
  const fromTs = new Date(range.from).getTime();
  const toTs = new Date(range.to).getTime();
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  if ([fromTs, toTs, startTs, endTs].some(Number.isNaN)) return true;
  return startTs < toTs && endTs > fromTs;
};

export const demoSchedulesPort: SchedulesPort = {
  async list(range) {
    return demoItems.filter((item) => withinRange(item, range));
  },
};
