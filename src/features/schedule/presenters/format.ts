type ScheduleLike = {
  start?: string | null;
  end?: string | null;
  startLocal?: string | null;
  endLocal?: string | null;
  startUtc?: string | null;
  endUtc?: string | null;
  audience?: string[] | null;
  targetUserNames?: string[] | null;
  location?: string | null;
};

export function formatOrgSubtitle(schedule: ScheduleLike): string {
  const start = schedule.startLocal ?? schedule.start ?? schedule.startUtc ?? '';
  const end = schedule.endLocal ?? schedule.end ?? schedule.endUtc ?? '';
  const audienceSource = Array.isArray(schedule.audience) && schedule.audience.length
    ? schedule.audience
    : Array.isArray(schedule.targetUserNames) && schedule.targetUserNames.length
      ? schedule.targetUserNames
      : null;
  const audience = audienceSource ? audienceSource.join(', ') : undefined;
  const location = schedule.location?.trim();

  const parts = [audience, location].filter(Boolean);
  if (!parts.length) {
    return [start, end].filter(Boolean).join(' - ');
  }
  return parts.join(' / ');
}
