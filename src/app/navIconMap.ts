/**
 * Icon mapping for navigation items.
 * Extracted from AppShell.tsx to reduce component size.
 */
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GavelIcon from '@mui/icons-material/Gavel';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import DirectionsBusFilledRoundedIcon from '@mui/icons-material/DirectionsBusFilledRounded';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import HistoryIcon from '@mui/icons-material/History';
import InsightsIcon from '@mui/icons-material/Insights';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import type React from 'react';

export const navIconMap: Record<string, React.ElementType> = {
  '日次記録': AssignmentTurnedInRoundedIcon,
  '健康記録': EditNoteIcon,
  '申し送りタイムライン': HistoryIcon,
  '送迎配車表': DirectionsBusFilledRoundedIcon,
  '司会ガイド': PsychologyIcon,
  '朝会（作成）': AddCircleOutlineIcon,
  '夕会（作成）': AddCircleOutlineIcon,
  '議事録アーカイブ': EditNoteIcon,
  '記録一覧': AssignmentTurnedInRoundedIcon,
  '月次記録': AssessmentRoundedIcon,
  '分析': InsightsIcon,
  '氷山分析': WorkspacesIcon,
  '氷山PDCA': HistoryIcon,
  'アセスメント': PsychologyIcon,
  '特性アンケート': EditNoteIcon,
  '利用者': PeopleAltRoundedIcon,
  '職員': BadgeRoundedIcon,
  '職員勤怠': BadgeRoundedIcon,
  '支援手順マスタ': ChecklistRoundedIcon,
  '個別支援手順': WorkspacesIcon,
  '職員勤怠管理': BadgeRoundedIcon,
  '自己点検': ChecklistRoundedIcon,
  '監査ログ': AssessmentRoundedIcon,
  '支援活動マスタ': SettingsRoundedIcon,
  'スケジュール': EventAvailableRoundedIcon,
  'コンプラ報告': ChecklistRoundedIcon,
  '個別支援計画': EditNoteIcon,
  'モニタリング記録': AssessmentRoundedIcon,
  '制度遵守ダッシュボード': GavelIcon,
};
