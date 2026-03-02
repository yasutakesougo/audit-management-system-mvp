// ---------------------------------------------------------------------------
// SceneQuickView — 場面別支援手順クイックビュー
// タブレット1タップ操作を前提としたアイコンインデックス + 手順展開UI
// ---------------------------------------------------------------------------
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import HomeIcon from '@mui/icons-material/Home';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningIcon from '@mui/icons-material/Warning';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FC, ReactElement } from 'react';
import { useCallback, useState } from 'react';

import type { SceneType, SupportScene } from '../ibdTypes';
import {
    resolveStepCategory,
    SCENE_TYPE_LABELS,
    STRATEGY_STAGE_LABELS,
    SUPPORT_CATEGORY_CONFIG,
} from '../ibdTypes';
import PositiveConditionsBanner from './PositiveConditionsBanner';

// ---------------------------------------------------------------------------
// アイコンマッピング
// ---------------------------------------------------------------------------

const SCENE_ICONS: Record<SceneType, ReactElement> = {
  arrival: <DirectionsWalkIcon />,
  meal: <RestaurantIcon />,
  activity: <SportsEsportsIcon />,
  transition: <SwapHorizIcon />,
  panic: <WarningIcon />,
  departure: <HomeIcon />,
  other: <MoreHorizIcon />,
};

const SCENE_COLORS: Record<SceneType, string> = {
  arrival: 'primary.main',
  meal: 'success.main',
  activity: 'info.main',
  transition: 'warning.main',
  panic: 'error.main',
  departure: 'secondary.main',
  other: 'grey.600',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SceneQuickViewProps = {
  /** 場面一覧 */
  scenes: SupportScene[];
  /** 支援手順をタップ時に記録画面にコピーするコールバック */
  onProcedureTap?: (sceneLabel: string, action: string) => void;
};

/**
 * 場面別支援手順クイックビュー
 *
 * 上部にアイコンインデックス、下部に選択した場面の手順を展開表示。
 * 各場面の冒頭には「良い状態の条件バナー」を配置し予防的支援を促進。
 */
const SceneQuickView: FC<SceneQuickViewProps> = ({ scenes, onProcedureTap }) => {
  const [selectedScene, setSelectedScene] = useState<string | null>(
    scenes[0]?.id ?? null
  );

  const activeScene = scenes.find((s) => s.id === selectedScene);

  const handleSceneSelect = useCallback((sceneId: string) => {
    setSelectedScene(sceneId);
  }, []);

  if (scenes.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
        <Typography color="text.secondary">場面別支援手順が未登録です</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2} data-testid="scene-quick-view">
      {/* ── アイコンインデックス ── */}
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ justifyContent: 'center' }}
      >
        {scenes.map((scene) => {
          const isActive = scene.id === selectedScene;
          const icon = SCENE_ICONS[scene.sceneType] ?? <MoreHorizIcon />;
          const color = SCENE_COLORS[scene.sceneType] ?? 'grey.600';

          return (
            <Paper
              key={scene.id}
              variant={isActive ? 'elevation' : 'outlined'}
              elevation={isActive ? 4 : 0}
              onClick={() => handleSceneSelect(scene.id)}
              data-testid={`scene-icon-${scene.sceneType}`}
              sx={{
                p: 1.5,
                cursor: 'pointer',
                borderRadius: 2,
                textAlign: 'center',
                minWidth: 80,
                border: isActive ? 2 : 1,
                borderColor: isActive ? color : 'divider',
                bgcolor: isActive ? `${String(color).replace('.main', '.light')}` : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: color,
                  transform: 'scale(1.05)',
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: isActive ? color : 'grey.200',
                  color: isActive ? '#fff' : 'grey.600',
                  width: 40,
                  height: 40,
                  mx: 'auto',
                  mb: 0.5,
                }}
              >
                {icon}
              </Avatar>
              <Typography variant="caption" sx={{ fontWeight: isActive ? 700 : 400 }}>
                {scene.label || SCENE_TYPE_LABELS[scene.sceneType]}
              </Typography>
            </Paper>
          );
        })}
      </Stack>

      {/* ── 選択場面の手順展開 ── */}
      {activeScene && (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* 場面ヘッダー */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: SCENE_COLORS[activeScene.sceneType], color: '#fff' }}>
                {SCENE_ICONS[activeScene.sceneType]}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {activeScene.label || SCENE_TYPE_LABELS[activeScene.sceneType]}
              </Typography>
            </Stack>

            {/* 良い状態の条件バナー（最上位配置） */}
            <PositiveConditionsBanner
              conditions={activeScene.positiveConditions}
              sceneName={activeScene.label}
            />

            <Divider />

            {/* 手順ステップ */}
            {activeScene.procedures.length > 0 ? (
              <Stack spacing={1.5}>
                {activeScene.procedures.map((step) => (
                  <Paper
                    key={step.order}
                    variant="outlined"
                    onClick={() => onProcedureTap?.(activeScene.label, step.supporterAction)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      cursor: onProcedureTap ? 'pointer' : 'default',
                      borderLeft: 4,
                      borderLeftColor: SUPPORT_CATEGORY_CONFIG[resolveStepCategory(step)].color,
                      '&:hover': onProcedureTap ? {
                        bgcolor: 'action.hover',
                      } : {},
                    }}
                    data-testid={`procedure-step-${step.order}`}
                  >
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={STRATEGY_STAGE_LABELS[step.stage]}
                          size="small"
                          color={
                            step.stage === 'proactive' ? 'success'
                              : step.stage === 'crisisResponse' ? 'error'
                                : 'warning'
                          }
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          #{step.order}
                        </Typography>
                      </Stack>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            本人の行動
                          </Typography>
                          <Typography variant="body2">{step.personAction}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            支援者の関わり
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {step.supporterAction}
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                手順が未登録です
              </Typography>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default SceneQuickView;
