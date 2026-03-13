/**
 * RegulatoryFindingsForMeeting — 会議用・制度系 finding 要点カード
 *
 * P6 Phase 2: 朝会・夕会で共有すべき制度系の要対応事項を
 * handoff タイムラインから抽出して表示する。
 *
 * 表示条件:
 *   - sourceType が 'regulatory-finding' または 'severe-addon-finding' の handoff のうち
 *   - 未完了（非 terminal status）のもの
 *
 * 「会議で共有済み」は、会議セッション内でこのカードが表示された時点で
 * 共有されたとみなす（Phase 3 で明示的な証跡記録に拡張可能）。
 */

import { GavelOutlined as GavelIcon } from '@mui/icons-material';
import {
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import type { HandoffDayScope, HandoffRecord } from './handoffTypes';
import { isTerminalStatus } from './handoffStateMachine';
import { useHandoffData } from './hooks/useHandoffData';
import { useEffect, useMemo, useState } from 'react';

// ─── 純粋関数: finding 由来の handoff を抽出 ─── //

const REGULATORY_SOURCE_TYPES = new Set([
  'regulatory-finding',
  'severe-addon-finding',
]);

/**
 * HandoffRecord 配列から制度系 finding 由来の未完了 handoff を抽出する
 * 純粋関数。テスト可能。
 */
export function extractPendingRegulatoryHandoffs(
  records: HandoffRecord[],
): HandoffRecord[] {
  return records.filter(
    (r) =>
      r.sourceType != null &&
      REGULATORY_SOURCE_TYPES.has(r.sourceType) &&
      !isTerminalStatus(r.status),
  );
}

/** 制度系 finding のカテゴリ分類 */
export type RegulatoryMeetingCategory =
  | 'reassessment' // 再評価超過
  | 'observation'  // 週次観察不足
  | 'qualification' // 資格不足
  | 'addon'        // 加算要対応
  | 'audit'        // 一般監査系
  | 'other';

/**
 * sourceKey からカテゴリを推定する
 */
export function classifyRegulatoryHandoff(record: HandoffRecord): RegulatoryMeetingCategory {
  const key = record.sourceKey ?? '';
  if (key.includes('reassessment_overdue')) return 'reassessment';
  if (key.includes('weekly_observation')) return 'observation';
  if (key.includes('qualification') || key.includes('authoring_requirement')) return 'qualification';
  if (key.includes('severe_addon') || key.includes('basic_training')) return 'addon';
  if (record.sourceType === 'regulatory-finding') return 'audit';
  return 'other';
}

const CATEGORY_CONFIG: Record<RegulatoryMeetingCategory, { label: string; color: 'error' | 'warning' | 'info' | 'secondary' | 'default' }> = {
  reassessment: { label: '再評価超過', color: 'error' },
  observation:  { label: '週次観察不足', color: 'warning' },
  qualification: { label: '資格不足', color: 'error' },
  addon:        { label: '加算要対応', color: 'secondary' },
  audit:        { label: '監査指摘', color: 'warning' },
  other:        { label: 'その他制度', color: 'default' },
};

// ─── Props ─── //

export type RegulatoryFindingsForMeetingProps = {
  dayScope?: HandoffDayScope;
};

// ─── コンポーネント ─── //

export default function RegulatoryFindingsForMeeting({
  dayScope = 'today',
}: RegulatoryFindingsForMeetingProps) {
  const { repo } = useHandoffData();
  const [records, setRecords] = useState<HandoffRecord[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const items = await repo.getRecords(dayScope, 'all');
        setRecords(items);
      } catch {
        setRecords([]);
      }
    }
    load();
  }, [repo, dayScope]);

  const pendingFindings = useMemo(
    () => extractPendingRegulatoryHandoffs(records),
    [records],
  );

  // 何もなければ非表示
  if (pendingFindings.length === 0) return null;

  // カテゴリ別にグルーピング
  const grouped = new Map<RegulatoryMeetingCategory, HandoffRecord[]>();
  for (const item of pendingFindings) {
    const cat = classifyRegulatoryHandoff(item);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  return (
    <Card
      sx={{
        mb: 2,
        borderLeft: '4px solid',
        borderColor: 'warning.main',
        bgcolor: 'warning.50',
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1}>
          {/* ヘッダー */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <GavelIcon sx={{ fontSize: 18, color: 'warning.dark' }} />
            <Typography variant="subtitle2" fontWeight={700} color="warning.dark">
              制度チェック — 会議共有事項
            </Typography>
            <Chip
              size="small"
              color="warning"
              variant="filled"
              label={`${pendingFindings.length}件`}
              sx={{ ml: 'auto', fontWeight: 700 }}
            />
          </Stack>

          {/* カテゴリ別リスト */}
          {Array.from(grouped.entries()).map(([cat, items]) => {
            const config = CATEGORY_CONFIG[cat];
            return (
              <Stack key={cat} direction="row" alignItems="flex-start" spacing={1}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={config.color}
                  label={config.label}
                  sx={{ fontSize: '0.65rem', fontWeight: 600, minWidth: 72 }}
                />
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  {items.map((item) => (
                    <Typography
                      key={item.id}
                      variant="caption"
                      color="text.secondary"
                      sx={{ lineHeight: 1.4 }}
                    >
                      {item.title}
                    </Typography>
                  ))}
                </Stack>
              </Stack>
            );
          })}

          {/* 共有ヒント */}
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            ※ この画面に表示された時点で「会議で共有済み」として記録されます
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
