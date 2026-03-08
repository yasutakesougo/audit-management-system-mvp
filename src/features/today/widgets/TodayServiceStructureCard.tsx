/**
 * TodayServiceStructureCard — 今日の業務体制
 *
 * 「担当表」ではなく「業務体制」を可視化する。
 * 3セクション: 生活介護 / 生活支援 / 判断窓口
 *
 * - 生活介護: 集団対応の配置・役割
 * - 生活支援: ショートステイ・一時ケア受け入れ体制
 * - 判断窓口: 所長・サビ管・ナースの在席
 *
 * @see Issue 3: /today に TodayServiceStructureCard を追加
 */
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
    Box,
    Chip,
    Divider,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import React from 'react';
import type { ServiceStructure } from '../domain/serviceStructure.types';
import { EmptyStateBlock } from './EmptyStateBlock';

// ─── Props ───────────────────────────────────────────────────

export type TodayServiceStructureCardProps = {
  serviceStructure: ServiceStructure;
};

// ─── Helpers ─────────────────────────────────────────────────

function RoleRow({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', py: 0.25 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', minWidth: 90, flexShrink: 0, fontSize: '0.7rem' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
        {names.join('、')}
      </Typography>
    </Box>
  );
}

function PresenceIndicator({ label, present, names }: { label: string; present: boolean; names: string[] }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
      {present ? (
        <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
      ) : (
        <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
      )}
      <Typography variant="body2" sx={{ fontSize: '0.8rem', minWidth: 48 }}>
        {label}
      </Typography>
      <Chip
        size="small"
        label={present ? '在席' : '不在'}
        color={present ? 'success' : 'default'}
        variant={present ? 'filled' : 'outlined'}
        sx={{ fontSize: '0.65rem', height: 20, '& .MuiChip-label': { px: 0.75 } }}
      />
      {present && names.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {names.join('、')}
        </Typography>
      )}
    </Box>
  );
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'text.secondary',
        fontSize: '0.65rem',
        mb: 0.5,
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
  const { dayCare, lifeSupport, decisionSupport } = serviceStructure;

  const hasDayCareStaff =
    dayCare.floorWatchStaff.length > 0 ||
    dayCare.activityLeadStaff.length > 0 ||
    dayCare.mealSupportStaff.length > 0 ||
    dayCare.recordCheckStaff.length > 0 ||
    dayCare.returnAcceptStaff.length > 0;

  const hasLifeSupport = lifeSupport.shortStayCount > 0 || lifeSupport.temporaryCareCount > 0;

  return (
    <Paper
      data-testid="today-service-structure-card"
      sx={{ p: 2, mb: 3 }}
    >
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
        🏢 今日の業務体制
      </Typography>

      <Stack spacing={2}>
        {/* ── A. 生活介護 ── */}
        <Box>
          <SectionHeader emoji="🟢" title="生活介護" />
          {hasDayCareStaff ? (
            <Box data-testid="section-daycare">
              <RoleRow label="フロア見守り" names={dayCare.floorWatchStaff} />
              <RoleRow label="活動進行" names={dayCare.activityLeadStaff} />
              <RoleRow label="食事対応" names={dayCare.mealSupportStaff} />
              <RoleRow label="記録確認" names={dayCare.recordCheckStaff} />
              <RoleRow label="送迎戻り受入" names={dayCare.returnAcceptStaff} />
            </Box>
          ) : (
            <EmptyStateBlock
              icon={<BusinessCenterIcon />}
              title="配置情報はありません"
              description="スケジュール登録後に表示されます。"
              testId="empty-daycare"
            />
          )}
        </Box>

        <Divider />

        {/* ── B. 生活支援（ショートステイ・一時ケア） ── */}
        <Box>
          <SectionHeader emoji="🔵" title="生活支援（ショートステイ・一時ケア）" />
          {hasLifeSupport ? (
            <Box data-testid="section-life-support">
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                {lifeSupport.shortStayCount > 0 && (
                  <Chip
                    size="small"
                    label={`ショートステイ ${lifeSupport.shortStayCount}件`}
                    color="primary"
                    variant="outlined"
                  />
                )}
                {lifeSupport.temporaryCareCount > 0 && (
                  <Chip
                    size="small"
                    label={`一時ケア ${lifeSupport.temporaryCareCount}件`}
                    color="secondary"
                    variant="outlined"
                  />
                )}
              </Box>
              <RoleRow label="受け入れ窓口" names={lifeSupport.intakeDeskStaff} />
              <RoleRow label="対応職員" names={lifeSupport.supportStaff} />
              <RoleRow label="調整確認" names={lifeSupport.coordinatorStaff} />
              {lifeSupport.notes.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  {lifeSupport.notes.map((note, i) => (
                    <Typography
                      key={i}
                      variant="caption"
                      sx={{ display: 'block', color: 'warning.main', fontSize: '0.7rem' }}
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
              sx={{ fontStyle: 'italic', py: 0.5, display: 'block' }}
              data-testid="empty-life-support"
            >
              本日の生活支援受け入れ予定はありません
            </Typography>
          )}
        </Box>

        <Divider />

        {/* ── C. 判断窓口 ── */}
        <Box data-testid="section-decision-support">
          <SectionHeader emoji="🟡" title="判断窓口" />
          <PresenceIndicator label="所長" present={decisionSupport.directorPresent} names={decisionSupport.directorNames} />
          <PresenceIndicator label="サビ管" present={decisionSupport.serviceManagerPresent} names={decisionSupport.serviceManagerNames} />
          <PresenceIndicator label="ナース" present={decisionSupport.nursePresent} names={decisionSupport.nurseNames} />
        </Box>
      </Stack>
    </Paper>
  );
};
