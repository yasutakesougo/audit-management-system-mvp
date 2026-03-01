/**
 * FeatureChipList — 集約特性フィールドのチップベース表示コンポーネント
 *
 * parseAggregatedFeatures() でパースした { label, content } 配列を受け取り、
 * ラベルをカテゴリカラーのチップ（Badge）として表示し、内容を横に配置する。
 * タブレット現場での視認性を最優先に設計。
 */
import { type FeatureEntry, parseAggregatedFeatures } from '@/domain/assessment/tokusei';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// Color palette — カテゴリラベルに応じたアクセントカラー
// ---------------------------------------------------------------------------

const LABEL_COLOR_MAP: Record<string, string> = {
  // 感覚
  '聴覚': '#3D6B3C',
  '視覚': '#6a1b9a',
  '触覚': '#00695c',
  '嗅覚': '#e65100',
  '味覚': '#ad1457',
  '該当する感覚': '#0277bd',
  '感覚の詳細': '#455a64',

  // 対人関係
  '対人関係の難しさ': '#c62828',
  '状況理解の難しさ': '#d84315',

  // こだわり
  '変化への対応困難': '#ef6c00',
  '物の一部への興味': '#f9a825',
  '繰り返し行動': '#ff8f00',
  '習慣への固執': '#e65100',

  // コミュニケーション
  '理解の困難': '#5e35b1',
  '発信の困難': '#7b1fa2',
  'やり取りの困難': '#4527a0',

  // 行動
  '該当する行動': '#2e7d32',
  '行動エピソード': '#1b5e20',
};

const DEFAULT_COLOR = '#546e7a';

const getChipColor = (label: string): string =>
  LABEL_COLOR_MAP[label] ?? DEFAULT_COLOR;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type FeatureChipListProps = {
  /** 集約された特性文字列（`【ラベル】内容` 形式） */
  value: string | undefined;
  /** エントリがない場合のフォールバックテキスト */
  emptyText?: string;
};

const FeatureChipList: React.FC<FeatureChipListProps> = ({
  value,
  emptyText = '未入力',
}) => {
  const entries: FeatureEntry[] = parseAggregatedFeatures(value);

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        {emptyText}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {entries.map((entry, index) => (
        <Box
          key={`${entry.label}-${index}`}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
          }}
        >
          <Chip
            label={entry.label}
            size="small"
            sx={{
              backgroundColor: getChipColor(entry.label),
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.75rem',
              height: 24,
              flexShrink: 0,
              mt: '2px',
            }}
          />
          <Typography
            variant="body2"
            sx={{
              lineHeight: 1.6,
              wordBreak: 'break-word',
            }}
          >
            {entry.content}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
};

export default FeatureChipList;
