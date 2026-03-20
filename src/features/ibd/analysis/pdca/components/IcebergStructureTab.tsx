/**
 * IcebergStructureTab — 氷山構造タブ（Phase 2 ビジュアル版）
 *
 * ABC記録データから「行動（水面上）」「場面・環境（水面付近）」「背景要因（水面下）」の
 * 3層構造を SVG 氷山ダイアグラムとして表示する。
 * 各層をクリック/タップすると右側（モバイルは下部）に詳細が展開される。
 *
 * @module features/ibd/analysis/pdca/components/IcebergStructureTab
 */

import * as React from 'react';
import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import WavesRoundedIcon from '@mui/icons-material/WavesRounded';

import type { AbcRecord, AbcIntensity } from '@/domain/abc/abcRecord';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';

// ════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════

const INTENSITY_DISPLAY: Record<AbcIntensity, string> = {
  low: '軽度',
  medium: '中度',
  high: '重度',
};

const INTENSITY_COLOR: Record<AbcIntensity, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

// ════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════

interface Props {
  userId: string;
}

type IcebergLayerKey = 'behavior' | 'setting' | 'antecedent';

interface LayerItem {
  label: string;
  count: number;
}

interface LayerData {
  behaviors: LayerItem[];
  settings: LayerItem[];
  intensities: Record<AbcIntensity, number>;
  antecedents: LayerItem[];
  total: number;
}

// ════════════════════════════════════════════════
// Layer metadata
// ════════════════════════════════════════════════

const LAYER_META: Record<IcebergLayerKey, {
  title: string;
  subtitle: string;
  description: string;
  emptyMessage: string;
  color: string;
  bgColor: string;
  borderColor: string;
  chipColor: 'primary' | 'warning' | 'success';
}> = {
  behavior: {
    title: '行動（Behavior）',
    subtitle: '水面上 — 外から見える行動',
    description: '観察されたBehaviorの頻出パターンです。同じ行動が繰り返し出現する場合は、その背景にある要因を掘り下げる手がかりになります。',
    emptyMessage: '行動データがまだありません',
    color: '#1565c0',
    bgColor: '#e3f2fd',
    borderColor: '#1976d2',
    chipColor: 'primary',
  },
  setting: {
    title: '場面・環境（Setting）',
    subtitle: '水面付近 — 行動が起きやすい状況',
    description: '行動が発生した場面や環境条件です。特定の場面で行動が集中している場合、環境調整が有効な支援アプローチになります。',
    emptyMessage: '場面データがまだありません',
    color: '#e65100',
    bgColor: '#fff3e0',
    borderColor: '#f57c00',
    chipColor: 'warning',
  },
  antecedent: {
    title: '背景要因（Antecedent）',
    subtitle: '水面下 — 行動の引き金になっている要因',
    description: '行動の直前に観察された先行事象です。最も深い層にある「なぜその行動が起きるのか」を理解するための鍵になります。',
    emptyMessage: '先行事象データがまだありません',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    borderColor: '#388e3c',
    chipColor: 'success',
  },
};

// ════════════════════════════════════════════════
// Pure helpers
// ════════════════════════════════════════════════

function buildLayerData(records: AbcRecord[]): LayerData {
  const behaviorMap = new Map<string, number>();
  const settingMap = new Map<string, number>();
  const antecedentMap = new Map<string, number>();
  const intensities: Record<AbcIntensity, number> = { low: 0, medium: 0, high: 0 };

  for (const r of records) {
    const b = r.behavior.slice(0, 20).trim();
    if (b) behaviorMap.set(b, (behaviorMap.get(b) ?? 0) + 1);

    if (r.setting) settingMap.set(r.setting, (settingMap.get(r.setting) ?? 0) + 1);

    intensities[r.intensity]++;

    const a = r.antecedent.slice(0, 25).trim();
    if (a) antecedentMap.set(a, (antecedentMap.get(a) ?? 0) + 1);
  }

  const toTopN = (map: Map<string, number>, n: number) =>
    [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([label, count]) => ({ label, count }));

  return {
    behaviors: toTopN(behaviorMap, 5),
    settings: toTopN(settingMap, 5),
    intensities,
    antecedents: toTopN(antecedentMap, 5),
    total: records.length,
  };
}

function getLayerItems(layers: LayerData, key: IcebergLayerKey): LayerItem[] {
  switch (key) {
    case 'behavior': return layers.behaviors;
    case 'setting': return layers.settings;
    case 'antecedent': return layers.antecedents;
  }
}

// ════════════════════════════════════════════════
// SVG Iceberg Diagram
// ════════════════════════════════════════════════

const SVG_WIDTH = 360;
const SVG_HEIGHT = 420;
const WATERLINE_Y = 160;

interface IcebergSvgProps {
  activeLayer: IcebergLayerKey | null;
  onLayerClick: (key: IcebergLayerKey) => void;
  layers: LayerData;
}

function IcebergSvgFixed({ activeLayer, onLayerClick, layers }: IcebergSvgProps) {
  const W = WATERLINE_Y;

  const layerOpacity = (key: IcebergLayerKey) =>
    activeLayer === null ? 1 : activeLayer === key ? 1 : 0.35;

  const layerStroke = (key: IcebergLayerKey) =>
    activeLayer === key ? LAYER_META[key].color : 'transparent';

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      style={{ width: '100%', maxWidth: 360, height: 'auto' }}
      role="img"
      aria-label="氷山構造ダイアグラム"
    >
      <defs>
        <linearGradient id="icebergWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b3e5fc" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0277bd" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="iceAbove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e1f5fe" />
          <stop offset="100%" stopColor="#b3e5fc" />
        </linearGradient>
        <linearGradient id="iceMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3e0" />
          <stop offset="100%" stopColor="#ffe0b2" />
        </linearGradient>
        <linearGradient id="iceDeep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8f5e9" />
          <stop offset="100%" stopColor="#a5d6a7" />
        </linearGradient>
      </defs>

      {/* 空 */}
      <rect x="0" y="0" width={SVG_WIDTH} height={W} fill="#f0f9ff" />
      {/* 水 */}
      <rect x="0" y={W} width={SVG_WIDTH} height={SVG_HEIGHT - W} fill="url(#icebergWater)" />

      {/* 水面の波 */}
      <path
        d={`M0,${W} Q45,${W - 6} 90,${W} T180,${W} T270,${W} T360,${W}`}
        fill="none" stroke="#4fc3f7" strokeWidth="2" opacity="0.7"
      />
      <path
        d={`M0,${W + 4} Q45,${W - 2} 90,${W + 4} T180,${W + 4} T270,${W + 4} T360,${W + 4}`}
        fill="none" stroke="#4fc3f7" strokeWidth="1.5" opacity="0.4"
      />

      {/* ═══ 層1: 行動（水面上） ═══ */}
      <g
        onClick={() => onLayerClick('behavior')}
        style={{ cursor: 'pointer' }}
        opacity={layerOpacity('behavior')}
      >
        <polygon
          points={`180,30 240,${W} 120,${W}`}
          fill="url(#iceAbove)"
          stroke={layerStroke('behavior')}
          strokeWidth="2.5"
        />
        <text x="180" y="85" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0d47a1">行動</text>
        <text x="180" y="100" textAnchor="middle" fontSize="9" fill="#1565c0">(Behavior)</text>
        {layers.behaviors[0] && (
          <text x="180" y="120" textAnchor="middle" fontSize="8.5" fill="#1976d2">
            {layers.behaviors[0].label} ({layers.behaviors[0].count})
          </text>
        )}
        {layers.behaviors.length > 1 && (
          <text x="180" y="135" textAnchor="middle" fontSize="7.5" fill="#64b5f6">
            +{layers.behaviors.length - 1} 件
          </text>
        )}
      </g>

      {/* ═══ 層2: 場面・環境（水面下上部） ═══ */}
      <g
        onClick={() => onLayerClick('setting')}
        style={{ cursor: 'pointer' }}
        opacity={layerOpacity('setting')}
      >
        <polygon
          points={`120,${W} 240,${W} 280,280 100,280`}
          fill="url(#iceMid)"
          stroke={layerStroke('setting')}
          strokeWidth="2.5"
        />
        <text x="180" y="215" textAnchor="middle" fontSize="11" fontWeight="700" fill="#e65100">場面</text>
        <text x="180" y="230" textAnchor="middle" fontSize="9" fill="#f57c00">(Setting)</text>
        {layers.settings[0] && (
          <text x="180" y="250" textAnchor="middle" fontSize="8.5" fill="#ef6c00">
            {layers.settings[0].label} ({layers.settings[0].count})
          </text>
        )}
        {layers.settings.length > 1 && (
          <text x="180" y="265" textAnchor="middle" fontSize="7.5" fill="#ffb74d">
            +{layers.settings.length - 1} 件
          </text>
        )}
      </g>

      {/* ═══ 層3: 背景要因（水面下深部） ═══ */}
      <g
        onClick={() => onLayerClick('antecedent')}
        style={{ cursor: 'pointer' }}
        opacity={layerOpacity('antecedent')}
      >
        <polygon
          points="100,280 280,280 300,380 60,380"
          fill="url(#iceDeep)"
          stroke={layerStroke('antecedent')}
          strokeWidth="2.5"
        />
        <text x="180" y="320" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1b5e20">背景要因</text>
        <text x="180" y="335" textAnchor="middle" fontSize="9" fill="#2e7d32">(Antecedent)</text>
        {layers.antecedents[0] && (
          <text x="180" y="355" textAnchor="middle" fontSize="8.5" fill="#388e3c">
            {layers.antecedents[0].label} ({layers.antecedents[0].count})
          </text>
        )}
        {layers.antecedents.length > 1 && (
          <text x="180" y="370" textAnchor="middle" fontSize="7.5" fill="#81c784">
            +{layers.antecedents.length - 1} 件
          </text>
        )}
      </g>

      {/* 水面ラベル */}
      <text x="16" y={W - 8} fontSize="8" fill="#0288d1" fontWeight="600">
        ─── 水面 ───
      </text>

      {/* 件数サマリー */}
      <text x={SVG_WIDTH - 8} y={SVG_HEIGHT - 8} textAnchor="end" fontSize="7.5" fill="#90a4ae">
        ABC {layers.total} 件を集計
      </text>
    </svg>
  );
}

// ════════════════════════════════════════════════
// Detail Panel
// ════════════════════════════════════════════════

interface DetailPanelProps {
  layerKey: IcebergLayerKey;
  items: LayerItem[];
  intensities: Record<AbcIntensity, number>;
  total: number;
}

function DetailPanel({ layerKey, items, intensities, total }: DetailPanelProps) {
  const meta = LAYER_META[layerKey];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        bgcolor: meta.bgColor,
        borderLeftWidth: 4,
        borderLeftColor: meta.borderColor,
        transition: 'all 0.3s ease',
      }}
    >
      <Typography variant="subtitle1" fontWeight={700} sx={{ color: meta.color, mb: 0.5 }}>
        {meta.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {meta.subtitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
        {meta.description}
      </Typography>

      {/* パターン一覧 */}
      {items.length > 0 ? (
        <>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            頻出パターン TOP {items.length}
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {items.map((item, i) => (
              <Chip
                key={item.label}
                label={`${item.label} (${item.count})`}
                size="small"
                variant={i === 0 ? 'filled' : 'outlined'}
                color={i === 0 ? meta.chipColor : 'default'}
                sx={i === 0 ? { fontWeight: 600 } : undefined}
              />
            ))}
          </Stack>
        </>
      ) : (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
          {meta.emptyMessage}
        </Typography>
      )}

      {/* 強度分布（場面レイヤーの場合に表示） */}
      {layerKey === 'setting' && (
        <Box>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            強度分布
          </Typography>
          <Stack direction="row" spacing={1.5}>
            {(['low', 'medium', 'high'] as AbcIntensity[]).map(i => (
              <Stack key={i} direction="row" spacing={0.5} alignItems="center">
                <Chip
                  label={INTENSITY_DISPLAY[i]}
                  size="small"
                  color={INTENSITY_COLOR[i]}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
                <Typography variant="body2" fontWeight={700}>
                  {intensities[i]}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {/* 件数 */}
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, textAlign: 'right' }}>
        全 {total} 件の ABC 記録から集計
      </Typography>
    </Paper>
  );
}

// ════════════════════════════════════════════════
// Overview Panel (未選択時)
// ════════════════════════════════════════════════

function OverviewPanel({ layers }: { layers: LayerData }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#fafafa' }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        📊 氷山構造の読み方
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, mb: 2 }}>
        氷山の上部には<strong>目に見える行動</strong>が現れます。
        しかし、行動の原因は水面下に隠れています。
        各層をクリックすると、ABC記録から集計された詳細データを確認できます。
      </Typography>

      <Stack spacing={1}>
        {(['behavior', 'setting', 'antecedent'] as IcebergLayerKey[]).map(key => {
          const meta = LAYER_META[key];
          const items = getLayerItems(layers, key);
          return (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: meta.borderColor, flexShrink: 0 }} />
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 80 }}>
                {meta.title.split('（')[0]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {items.length > 0 ? `${items.length} パターン` : '—'}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
        氷山の層をクリックして詳細を表示
      </Typography>
    </Paper>
  );
}

// ════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════

export const IcebergStructureTab: React.FC<Props> = ({ userId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [records, setRecords] = React.useState<AbcRecord[]>([]);
  const [activeLayer, setActiveLayer] = React.useState<IcebergLayerKey | null>(null);

  React.useEffect(() => {
    let disposed = false;
    localAbcRecordRepository.getByUserId(userId).then(r => {
      if (!disposed) setRecords(r);
    });
    return () => { disposed = true; };
  }, [userId]);

  const layers = React.useMemo(() => buildLayerData(records), [records]);

  const handleLayerClick = React.useCallback((key: IcebergLayerKey) => {
    setActiveLayer(prev => prev === key ? null : key);
  }, []);

  // ── Empty state ──
  if (layers.total === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <WavesRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
        <Typography variant="h6" color="text.secondary" sx={{ mb: 0.5 }}>
          ABC記録がまだありません
        </Typography>
        <Typography variant="body2" color="text.disabled">
          「傾向」タブからABC記録を作成すると、ここに氷山構造が表示されます。
        </Typography>
      </Paper>
    );
  }

  // ── Main layout ──
  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          alignItems: 'flex-start',
        }}
      >
        {/* 左: SVG 氷山 */}
        <Box
          sx={{
            flexShrink: 0,
            width: isMobile ? '100%' : 360,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <IcebergSvgFixed
            activeLayer={activeLayer}
            onLayerClick={handleLayerClick}
            layers={layers}
          />
        </Box>

        {/* 右: 詳細パネル */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {activeLayer ? (
            <DetailPanel
              layerKey={activeLayer}
              items={getLayerItems(layers, activeLayer)}
              intensities={layers.intensities}
              total={layers.total}
            />
          ) : (
            <OverviewPanel layers={layers} />
          )}
        </Box>
      </Box>
    </Box>
  );
};
