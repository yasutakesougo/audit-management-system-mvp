const normalizeScheduleValue = (value: string) => value.replace(/[\s\u3000]+/g, '').trim();

export const getScheduleKey = (timeSlot: string, plannedActivity?: string): string => {
  const time = normalizeScheduleValue(timeSlot);
  const activity = normalizeScheduleValue(plannedActivity ?? '');
  return `${time}|${activity}`;
};
