/**
 * TodayServiceStructureCard — 今日の業務体制
 *
 * 「担当表」ではなく「業務体制」を可視化する。
 * 4セクション: 生活介護 / 生活支援 / 判断窓口 / 運営サポート
 *
 * - 生活介護: 第一作業室 / 第二作業室 / 外活動 / 和室 / プレイルーム
 * - 生活支援: ショートステイ・一時ケア受け入れ体制
 * - 判断窓口: 所長・サビ管・ナースの在席（管理者・専門職）
 * - 運営サポート: 会計・給食・送迎・ボランティア・来客の配置
 *
 * @see Issue 3: /today に TodayServiceStructureCard を追加
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
    Box,
    Chip,
    Stack,
    Typography
} from '@mui/material';
import React from 'react';
import type { ServiceStructure } from '../domain/serviceStructure.types';

// ─── Props ───────────────────────────────────────────────────

export type TodayServiceStructureCardProps = {
  serviceStructure: ServiceStructure;
};

// ─── Helpers ─────────────────────────────────────────────────

function RoleRow({
  label,
  names,
  showWhenEmpty = false,
  emptyLabel = '未割当',
}: {
  label: string;
  names: string[];
  showWhenEmpty?: boolean;
  emptyLabel?: string;
}) {
  const hasNames = names.length > 0;
  if (!hasNames && !showWhenEmpty) return null;
  return (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', py: 0.125 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', minWidth: 72, flexShrink: 0, fontSize: '0.68rem' }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontSize: '0.78rem',
          color: hasNames ? 'text.primary' : 'text.disabled',
          fontStyle: hasNames ? 'normal' : 'italic',
        }}
      >
        {hasNames ? names.join('、') : emptyLabel}
      </Typography>
    </Box>
  );
}

function PresenceIndicator({ label, present, names }: { label: string; present: boolean; names: string[] }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.125 }}>
      {present ? (
        <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
      ) : (
        <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      )}
      <Typography variant="body2" sx={{ fontSize: '0.76rem', minWidth: 40 }}>
        {label}
      </Typography>
      <Chip
        size="small"
        label={present ? '在席' : '不在'}
        color={present ? 'success' : 'default'}
        variant={present ? 'filled' : 'outlined'}
        sx={{ fontSize: '0.6rem', height: 18, '& .MuiChip-label': { px: 0.5 } }}
      />
      {present && names.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
          {names.join('、')}
        </Typography>
      )}
    </Box>
  );
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'text.secondary',
        fontSize: '0.7rem',
        mb: 0.25,
      }}
    >
      {emoji} {title}
    </Typography>
  );
}

// ─── Main Component ──────────────────────────────────────────

export const TodayServiceStructureCard: React.FC<TodayServiceStructureCardProps> = ({
  serviceStructure,
}) => {
  const { dayCare, lifeSupport, decisionSupport, operationalSupport } = serviceStructure;

  const hasLifeSupport = lifeSupport.shortStayCount > 0 || lifeSupport.temporaryCareCount > 0;

  return (
    <Box data-testid="today-service-structure-card">
      {/* ── 2x2 grid: 生活介護 / 生活支援 / 判断窓口 / 運営サポート ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: { xs: 1, sm: 1.5 },
        }}
      >
        {/* A. 生活介護 */}
        <Box>
          <SectionHeader emoji="🟢" title="生活介護" />
          <Box data-testid="section-daycare">
            <RoleRow label="第一作業室" names={dayCare.firstWorkroomStaff} showWhenEmpty />
            <RoleRow label="第二作業室" names={dayCare.secondWorkroomStaff} showWhenEmpty />
            <RoleRow label="外活動" names={dayCare.outdoorActivityStaff} showWhenEmpty />
            <RoleRow label="和室" names={dayCare.japaneseRoomStaff} showWhenEmpty />
            <RoleRow label="プレイルーム" names={dayCare.playroomStaff} showWhenEmpty />
          </Box>
        </Box>

        {/* B. 生活支援 */}
        <Box>
          <SectionHeader emoji="🔵" title="生活支援" />
          {hasLifeSupport ? (
            <Box data-testid="section-life-support">
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.25 }}>
                {lifeSupport.shortStayCount > 0 && (
                  <Chip
                    size="small"
                    label={`SS ${lifeSupport.shortStayCount}件`}
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {lifeSupport.temporaryCareCount > 0 && (
                  <Chip
                    size="small"
                    label={`一時 ${lifeSupport.temporaryCareCount}件`}
                    color="secondary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Stack>
              <RoleRow label="窓口" names={lifeSupport.intakeDeskStaff} />
              <RoleRow label="対応" names={lifeSupport.supportStaff} />
              <RoleRow label="調整" names={lifeSupport.coordinatorStaff} />
              {lifeSupport.notes.length > 0 && (
                <Box sx={{ mt: 0.25 }}>
                  {lifeSupport.notes.map((note, i) => (
                    <Typography
                      key={i}
                      variant="caption"
                      sx={{ display: 'block', color: 'warning.main', fontSize: '0.65rem' }}
                    >
                      ⚠ {note}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontStyle: 'italic', display: 'block', fontSize: '0.68rem' }}
              data-testid="empty-life-support"
            >
              受け入れ予定なし
            </Typography>
          )}
        </Box>

        {/* C. 判断窓口（管理者・専門職） */}
        <Box data-testid="section-decision-support">
          <SectionHeader emoji="🟡" title="判断窓口" />
          <PresenceIndicator label="所長" present={decisionSupport.directorPresent} names={decisionSupport.directorNames} />
          <PresenceIndicator label="サビ管" present={decisionSupport.serviceManagerPresent} names={decisionSupport.serviceManagerNames} />
          <PresenceIndicator label="ナース" present={decisionSupport.nursePresent} names={decisionSupport.nurseNames} />
        </Box>

        {/* D. 運営サポート（会計・給食・送迎） */}
        <Box data-testid="section-operational-support">
          <SectionHeader emoji="🟠" title="運営サポート" />
          <PresenceIndicator label="会計" present={operationalSupport.accountantPresent} names={operationalSupport.accountantNames} />
          <RoleRow label="給食" names={operationalSupport.mealStaff} showWhenEmpty />
          <RoleRow label="送迎" names={operationalSupport.transportStaff} />
          <RoleRow label="日中ボランティア" names={operationalSupport.volunteerStaff} showWhenEmpty />
          <RoleRow label="日中来客" names={operationalSupport.visitorNames} showWhenEmpty />
        </Box>
      </Box>
    </Box>
  );
};
