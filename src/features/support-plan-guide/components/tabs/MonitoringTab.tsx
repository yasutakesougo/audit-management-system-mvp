/**
 * MonitoringTab — モニタリングタブ
 *
 * SectionKey: 'monitoring'
 * プレゼンテーショナルコンポーネント（状態・副作用なし）。
 *
 * 他のセクションタブと異なり、MonitoringEvidenceSection を条件付きで描画する。
 */
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import { buildMonitoringEvidence } from '@/features/ibd/plans/support-plan/monitoringEvidenceAdapter';
import type { MonitoringEvidenceSectionProps, ToastState } from '../../types';
import { findSection, minusDaysYmd, todayYmd } from '../../utils/helpers';
import FieldCard from './FieldCard';
import type { SectionTabProps } from './tabProps';

export type MonitoringTabProps = SectionTabProps & {
  /** アクティブドラフトのuserId（エビデンス取得用） */
  userId: string | number | null | undefined;
  /** トースト表示用 */
  setToast: (toast: ToastState) => void;
};

/** エビデンスセクション（内部コンポーネント） */
const MonitoringEvidenceSection: React.FC<MonitoringEvidenceSectionProps> = ({ userId, onAppend, isAdmin }) => {
  const range = React.useMemo(() => {
    const to = todayYmd();
    return { from: minusDaysYmd(to, 60), to }; // 過去60日
  }, []);

  const evidence = React.useMemo(() => {
    return buildMonitoringEvidence({ userId, range });
  }, [userId, range]);

  if (evidence.count === 0) return null;

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoStoriesIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" component="span" color="primary">
                日次記録のエビデンス (過去60日: {evidence.count}件)
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => onAppend(evidence.text)}
              disabled={!isAdmin}
            >
              評価文へ引用
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ※ 一覧入力テーブルから自動集計された実績です。アセスメントやモニタリングの根拠として活用できます。
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1, p: 1, border: '1px solid', borderColor: 'divider' }}>
            <List dense disablePadding>
              {evidence.bullets.map((b: string, i: number) => (
                <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={b}
                    primaryTypographyProps={{ variant: 'caption', sx: { display: 'block', lineHeight: 1.4 } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

const MonitoringTab: React.FC<MonitoringTabProps> = ({ userId, setToast, ...sectionProps }) => {
  const section = findSection('monitoring');
  if (!section) return null;

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {userId && (
        <MonitoringEvidenceSection
          userId={String(userId)}
          isAdmin={sectionProps.isAdmin}
          onAppend={(text) => {
            const currentVal = sectionProps.form.monitoringPlan || '';
            const headerLine = text.split('\n')[0];
            if (currentVal.includes(headerLine)) {
              setToast({ open: true, message: 'この期間のエビデンスは既に引用されています。', severity: 'info' });
              return;
            }
            sectionProps.onFieldChange('monitoringPlan', (currentVal ? currentVal + '\n\n' : '') + text);
            setToast({ open: true, message: 'エビデンスを引用しました。内容を調整してください。', severity: 'success' });
          }}
        />
      )}

      <Stack spacing={2}>
        {section.fields.map((field) => (
          <FieldCard key={field.key} field={field} {...sectionProps} />
        ))}
      </Stack>
    </Stack>
  );
};

export default React.memo(MonitoringTab);
