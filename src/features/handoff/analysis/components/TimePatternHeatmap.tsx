/**
 * 時間パターンヒートマップ
 *
 * Phase 1-C computeTimePatterns の結果を曜日×時間帯グリッドで表示。
 * 件数に応じた背景色の濃淡で可視化。
 */

import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { TimePatternResult } from '../computeTimePatterns';
import { DAY_OF_WEEK_LABELS } from '../computeTimePatterns';

// ── 定数 ──

const TIME_BANDS = ['朝', '午前', '午後', '夕方'] as const;

/** 件数 → 背景色の不透明度 (0.0-1.0) */
function countToOpacity(count: number, maxCount: number): number {
  if (maxCount === 0 || count === 0) return 0;
  return Math.min(0.15 + (count / maxCount) * 0.85, 1.0);
}

// ── Props ──

interface TimePatternHeatmapProps {
  data: TimePatternResult;
}

export default function TimePatternHeatmap({ data }: TimePatternHeatmapProps) {
  if (data.patterns.length === 0) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <CalendarTodayIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>時間帯パターン</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 3 }}>
            分析対象の申し送りがありません
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // 最大件数（濃淡計算用）
  const maxCount = Math.max(...data.patterns.map(p => p.count), 1);

  // パターンの高速ルックアップ
  const patternMap = new Map(
    data.patterns.map(p => [`${p.dayOfWeek}:${p.timeBand}`, p]),
  );

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <CalendarTodayIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>時間帯パターン</Typography>
          <Typography variant="caption" color="text.secondary">
            曜日 × 時間帯
          </Typography>
        </Stack>

        {/* ヒートマップテーブル */}
        <Box sx={{ overflowX: 'auto' }}>
          <Box
            component="table"
            sx={{
              width: '100%',
              borderCollapse: 'collapse',
              '& th, & td': {
                textAlign: 'center',
                py: 0.75,
                px: 0.5,
                border: '1px solid',
                borderColor: 'divider',
                fontSize: '0.75rem',
              },
              '& th': {
                bgcolor: 'background.default',
                fontWeight: 600,
              },
            }}
          >
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                {TIME_BANDS.map(tb => (
                  <th key={tb}>{tb}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_OF_WEEK_LABELS.map((dayLabel, dayIndex) => (
                <tr key={dayIndex}>
                  <td style={{ fontWeight: 600 }}>
                    {dayLabel}
                  </td>
                  {TIME_BANDS.map(tb => {
                    const pattern = patternMap.get(`${dayIndex}:${tb}`);
                    const count = pattern?.count ?? 0;
                    const opacity = countToOpacity(count, maxCount);

                    return (
                      <Tooltip
                        key={tb}
                        title={
                          pattern
                            ? `${dayLabel}曜 ${tb}: ${count}件\n最頻カテゴリ: ${pattern.topCategory}\nピーク: ${pattern.peakHour}時台`
                            : `${dayLabel}曜 ${tb}: 0件`
                        }
                        arrow
                        placement="top"
                      >
                        <td
                          style={{
                            backgroundColor: count > 0
                              ? `rgba(25, 118, 210, ${opacity})`
                              : 'transparent',
                            color: opacity > 0.5 ? '#fff' : 'inherit',
                            fontWeight: count > 0 ? 600 : 400,
                            cursor: 'default',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          {count > 0 ? count : '·'}
                        </td>
                      </Tooltip>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>

        {/* 時間帯サマリー */}
        <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'center' }}>
          {data.byTimeBand.map(({ timeBand, count, topCategory }) => (
            <Stack key={timeBand} alignItems="center" spacing={0.25}>
              <Typography variant="caption" fontWeight={600}>{timeBand}</Typography>
              <Typography variant="h6" sx={{ lineHeight: 1 }}>{count}</Typography>
              <Typography variant="caption" color="text.secondary">{topCategory}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
