export function calculateUrgency(
  targetTime: Date | undefined,
  now: Date,
  slaMinutes = 0
): { score: number; isOverdue: boolean } {
  if (!targetTime) {
    return { score: 0, isOverdue: false };
  }

  const diffMinutes = (now.getTime() - targetTime.getTime()) / (1000 * 60);
  const isOverdue = diffMinutes > slaMinutes;

  let score = 50 + diffMinutes;

  if (isOverdue) {
    score += 100;
  }

  return {
    score: Math.max(0, Math.round(score)),
    isOverdue,
  };
}
