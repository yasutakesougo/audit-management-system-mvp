/**
 * DailyPhaseHintBanner — 日々の記録画面の時間帯ヒントUI
 *
 * OperationalPhase 基盤を使い、現在時刻から
 * 「今やるべき記録作業」のヒントを表示する。
 *
 * Phase 3 (設定値ベース判定):
 *   - resolvePhaseFromConfig() で設定配列から判定
 *   - config 未指定時は DEFAULT_PHASE_CONFIG にフォールバック
 *
 * 設計方針:
 *   - 強制ではなく案内（dismiss 可能）
 *   - 現場用語で端的に伝える
 *   - DailyRecordMenuPage のヘッダー直下で使用
 *   - 純粋関数 + 薄いUIの2層構成
 */

import { DEFAULT_PHASE_CONFIG } from '@/features/operationFlow/domain/defaultPhaseConfig';
import { resolvePhaseFromConfig } from '@/features/operationFlow/domain/phaseConfigBridge';
import type { OperationFlowPhaseConfig } from '@/features/operationFlow/domain/operationFlowTypes';
import { useOperationFlowConfig } from '@/features/operationFlow/hooks/useOperationFlowConfig';
import { PHASE_EVENTS, recordPhaseEvent } from '@/features/operationFlow/telemetry/recordPhaseEvent';
import type { OperationalPhase } from '@/shared/domain/operationalPhase';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

// ────────────────────────────────────────────────────────────
// 純粋関数: 時間帯ヒント判定
// ────────────────────────────────────────────────────────────

/**
 * 時間帯ヒント情報
 */
export interface DailyPhaseHint {
  /** 現在のフェーズ */
  phase: OperationalPhase;
  /** フェーズラベル（例: "AM活動"） */
  phaseLabel: string;
  /** メインメッセージ（現場用語） */
  message: string;
  /** 推奨アクション（カード案内用） */
  suggestedAction: string | null;
  /** 色テーマ */
  color: 'info' | 'warning' | 'success';
}

/**
 * 現在時刻から日々の記録画面向けのヒントを返す
 *
 * @param now    - 判定対象の日時（デフォルト: 現在時刻）
 * @param config - フェーズ設定配列（省略時は DEFAULT_PHASE_CONFIG）
 * @returns 時間帯ヒント情報
 *
 * フェーズ別ガイド:
 *   preparation     → 通所準備: 欠席連絡の確認
 *   morning-meeting → 朝会中: 通所管理の最終確認
 *   am-operation    → AM活動: 午前の活動記録を入れる時間
 *   pm-operation    → PM活動: 午後の記録・支援手順チェック
 *   evening-closing → 帰り支度: 未入力の記録を片付ける
 *   record-review   → 振り返り: 今日の記録を確認・仕上げ
 */
export function getDailyPhaseHint(
  now: Date = new Date(),
  config: readonly OperationFlowPhaseConfig[] = DEFAULT_PHASE_CONFIG,
): DailyPhaseHint {
  const resolved = resolvePhaseFromConfig(now, config);
  const phase = resolved.operationalPhase;
  const phaseLabel = resolved.phaseLabel;

  switch (phase) {
    case 'preparation':
      return {
        phase,
        phaseLabel,
        message: '出勤・朝準備の時間です。欠席連絡の確認からはじめましょう',
        suggestedAction: '通所管理',
        color: 'info',
      };

    case 'morning-meeting':
      return {
        phase,
        phaseLabel,
        message: '朝会の時間です。今日の通所状況を最終確認しましょう',
        suggestedAction: '通所管理',
        color: 'warning',
      };

    case 'am-operation':
      return {
        phase,
        phaseLabel,
        message: '午前活動の時間です。活動の様子を記録に残しましょう',
        suggestedAction: '一覧形式の日々の記録',
        color: 'info',
      };

    case 'pm-operation':
      return {
        phase,
        phaseLabel,
        message: '午後活動の時間です。午前分の記録がまだなら先に入力しましょう',
        suggestedAction: '一覧形式の日々の記録',
        color: 'info',
      };

    case 'evening-closing':
      return {
        phase,
        phaseLabel,
        message: '帰り支度の時間です。未入力の記録があれば今のうちに片付けましょう',
        suggestedAction: null,
        color: 'warning',
      };

    case 'record-review':
      return {
        phase,
        phaseLabel,
        message: '記録・振り返りの時間です。今日の記録を確認して仕上げましょう',
        suggestedAction: null,
        color: 'success',
      };
  }
}

// ────────────────────────────────────────────────────────────
// UIコンポーネント
// ────────────────────────────────────────────────────────────

export interface DailyPhaseHintBannerProps {
  /** テスト用: 時刻を外部注入 */
  now?: Date;
}

/**
 * 日々の記録ページ用の時間帯ヒントバナー
 *
 * 使い方:
 *   <DailyPhaseHintBanner />
 *   <DailyPhaseHintBanner now={new Date('2026-01-01T10:00:00')} />
 */
export function DailyPhaseHintBanner({ now }: DailyPhaseHintBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { config } = useOperationFlowConfig();
  const hint = getDailyPhaseHint(now, config);

  // ── 観測: 表示イベント (dedupe で重複防止) ──
  useEffect(() => {
    if (!dismissed) {
      recordPhaseEvent(
        { event: PHASE_EVENTS.SUGGEST_SHOWN, phase: hint.phase, screen: '/daily' },
        { dedupe: true },
      );
    }
  }, [dismissed, hint.phase]);

  if (dismissed) return null;

  /** MUI カラーパレットのマッピング */
  const colorMap = {
    info: { bg: 'info.50', border: 'info.200', icon: 'info.main' },
    warning: { bg: 'warning.50', border: 'warning.200', icon: 'warning.main' },
    success: { bg: 'success.50', border: 'success.200', icon: 'success.main' },
  } as const;

  const palette = colorMap[hint.color];

  return (
    <Box
      data-testid="daily-phase-hint-banner"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        mb: 2,
        borderRadius: 2,
        bgcolor: palette.bg,
        border: '1px solid',
        borderColor: palette.border,
      }}
    >
      {/* 時計アイコン */}
      <AccessTimeIcon
        sx={{
          fontSize: '1.2rem',
          color: palette.icon,
          flexShrink: 0,
        }}
      />

      {/* メッセージ */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: 'text.primary' }}
        >
          🕐 {hint.phaseLabel}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block' }}
        >
          {hint.message}
        </Typography>
      </Box>

      {/* 閉じるボタン */}
      <IconButton
        data-testid="daily-phase-hint-dismiss"
        size="small"
        onClick={() => {
          recordPhaseEvent({
            event: PHASE_EVENTS.SUGGEST_DISMISSED,
            phase: hint.phase,
            screen: '/daily',
          });
          setDismissed(true);
        }}
        sx={{ ml: -0.5, flexShrink: 0 }}
        aria-label="ヒントを閉じる"
      >
        <CloseIcon sx={{ fontSize: '1rem' }} />
      </IconButton>
    </Box>
  );
}
