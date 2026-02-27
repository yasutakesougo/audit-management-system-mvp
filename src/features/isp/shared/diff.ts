/**
 * ISP共通: LCS-based character-level diff
 */

export interface DiffSegment {
  type: 'same' | 'add' | 'del';
  text: string;
}

export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  if (!oldText && !newText) return [];
  if (!oldText) return [{ type: 'add', text: newText }];
  if (!newText) return [{ type: 'del', text: oldText }];
  if (oldText === newText) return [{ type: 'same', text: oldText }];

  const oldChars = oldText.split('');
  const newChars = newText.split('');
  const m = oldChars.length;
  const n = newChars.length;

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldChars[i - 1] === newChars[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Backtrace
  const rev: DiffSegment[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      rev.push({ type: 'same', text: oldChars[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rev.push({ type: 'add', text: newChars[j - 1] });
      j--;
    } else {
      rev.push({ type: 'del', text: oldChars[i - 1] });
      i--;
    }
  }
  rev.reverse();

  // Merge consecutive same-type segments
  const result: DiffSegment[] = [];
  for (const seg of rev) {
    if (result.length && result[result.length - 1].type === seg.type) {
      result[result.length - 1].text += seg.text;
    } else {
      result.push({ ...seg });
    }
  }
  return result;
}
