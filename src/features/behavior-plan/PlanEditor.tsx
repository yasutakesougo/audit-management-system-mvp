import React, { useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CrisisFlowchartEditor from './CrisisFlowchartEditor';
import type { BehaviorSupportPlan, FlowSupportActivityTemplate } from '../../types/behaviorPlan';

const functionalHypothesisOptions = ['注目獲得', '課題逃避', '感覚刺激', '自己刺激', '具体的アイテム要求', '疼痛回避'];

interface PlanEditorProps {
  plan: BehaviorSupportPlan;
  onPlanFieldChange: (updates: Partial<BehaviorSupportPlan>) => void;
  onFunctionalHypothesisChange: (tags: string[]) => void;
  onDailyActivitiesChange: (activities: FlowSupportActivityTemplate[]) => void;
  onCrisisFlowChange: (flow: Record<string, unknown>) => void;
  onCreateDraftFromActive: (monitoringSummary: string) => void;
}

type DailyActivityField = keyof FlowSupportActivityTemplate;

const PlanEditor: React.FC<PlanEditorProps> = ({
  plan,
  onPlanFieldChange,
  onFunctionalHypothesisChange,
  onDailyActivitiesChange,
  onCrisisFlowChange,
  onCreateDraftFromActive,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [monitoringSummary, setMonitoringSummary] = useState('');
  const [monitoringError, setMonitoringError] = useState<string | null>(null);

  const complianceAlert = useMemo(() => {
    if (plan.assessmentSummary.kodoScore >= 18) {
      return '行動関連項目が18点以上のため、中核的人材が計画策定に関与している必要があります。';
    }
    return null;
  }, [plan.assessmentSummary.kodoScore]);

  const handleActivityFieldChange = (
    index: number,
    field: DailyActivityField,
    value: string
  ) => {
    const nextActivities = [...plan.dailyActivities];
    nextActivities[index] = {
      ...nextActivities[index],
      [field]: value,
    };
    onDailyActivitiesChange(nextActivities);
  };

  const handleAddActivity = () => {
    const nextActivities = [
      ...plan.dailyActivities,
      {
        time: '',
        title: '',
        personTodo: '',
        supporterTodo: '',
        stage: 'proactive' as const,
      },
    ];
    onDailyActivitiesChange(nextActivities);
  };

  const handleRemoveActivity = (index: number) => {
    const nextActivities = plan.dailyActivities.filter((_, idx) => idx !== index);
    onDailyActivitiesChange(nextActivities);
  };

  const handleMonitoringSubmission = () => {
    if (!monitoringSummary.trim()) {
      setMonitoringError('モニタリング所見を入力してください。');
      return;
    }
    setMonitoringError(null);
    onCreateDraftFromActive(monitoringSummary.trim());
    setMonitoringSummary('');
  };

  return (
    <Card elevation={3}>
      <CardContent>
        <Stack spacing={3}>
          {complianceAlert && <Alert severity="info">{complianceAlert}</Alert>}

          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="機能仮説" />
            <Tab label="予防的支援" />
            <Tab label="代替スキル獲得" />
            <Tab label="危機時対応" />
            <Tab label="バージョン管理" />
          </Tabs>

          {activeTab === 0 && (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                機能仮説
              </Typography>
              <Autocomplete
                multiple
                options={functionalHypothesisOptions}
                freeSolo
                value={plan.assessmentSummary.functionalHypothesis}
                onChange={(_, value) => onFunctionalHypothesisChange(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="行動の機能仮説"
                    helperText="想定される行動機能をタグとして入力します。"
                  />
                )}
              />
              <TextField
                label="機能仮説の考察"
                multiline
                minRows={5}
                value={plan.assessmentSummary.assessmentNotes}
                onChange={(event) =>
                  onPlanFieldChange({
                    assessmentSummary: {
                      ...plan.assessmentSummary,
                      assessmentNotes: event.target.value,
                    },
                  })
                }
                helperText="アセスメントデータの根拠を明記してください。"
              />
            </Stack>
          )}

          {activeTab === 1 && (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                予防的支援（環境調整・コミュニケーション支援）
              </Typography>
              <TextField
                multiline
                minRows={6}
                value={plan.proactiveStrategies}
                onChange={(event) =>
                  onPlanFieldChange({ proactiveStrategies: event.target.value })
                }
                placeholder="例: 朝の会前に深圧ブランケットを提供し、感覚の充足を図る。"
              />
            </Stack>
          )}

          {activeTab === 2 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  代替スキルの獲得支援
                </Typography>
                <TextField
                  multiline
                  minRows={6}
                  value={plan.skillBuildingPlan}
                  onChange={(event) =>
                    onPlanFieldChange({ skillBuildingPlan: event.target.value })
                  }
                  placeholder="例: 絵カードで要求を伝える練習を午前中の課題後に実施する。"
                />
              </Box>

              <Divider />

              <Stack spacing={2}>
                <Typography variant="subtitle2" color="text.secondary">
                  日次記録システムに展開される支援手順
                </Typography>
                <Stack spacing={2}>
                  {plan.dailyActivities.map((activity, index) => (
                    <Card key={`${activity.title}-${index}`} variant="outlined">
                      <CardContent>
                        <Stack spacing={2}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" fontWeight={600}>
                              手順 #{index + 1}
                            </Typography>
                            <IconButton
                              aria-label="remove-activity"
                              onClick={() => handleRemoveActivity(index)}
                              size="small"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                              label="時間"
                              value={activity.time}
                              onChange={(event) =>
                                handleActivityFieldChange(index, 'time', event.target.value)
                              }
                              placeholder="09:45"
                            />
                            <TextField
                              label="活動名"
                              value={activity.title}
                              onChange={(event) =>
                                handleActivityFieldChange(index, 'title', event.target.value)
                              }
                              fullWidth
                              placeholder="例: 絵カード要求練習"
                            />
                            <TextField
                              select
                              label="ステージ"
                              value={activity.stage}
                              onChange={(event) =>
                                handleActivityFieldChange(
                                  index,
                                  'stage',
                                  event.target.value as FlowSupportActivityTemplate['stage']
                                )
                              }
                              sx={{ minWidth: 160 }}
                            >
                              <MenuItem value="proactive">予防的支援</MenuItem>
                              <MenuItem value="earlyResponse">早期対応</MenuItem>
                            </TextField>
                          </Stack>
                          <TextField
                            label="本人のやること"
                            multiline
                            minRows={3}
                            value={activity.personTodo}
                            onChange={(event) =>
                              handleActivityFieldChange(
                                index,
                                'personTodo',
                                event.target.value
                              )
                            }
                          />
                          <TextField
                            label="支援者のやること"
                            multiline
                            minRows={3}
                            value={activity.supporterTodo}
                            onChange={(event) =>
                              handleActivityFieldChange(
                                index,
                                'supporterTodo',
                                event.target.value
                              )
                            }
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    variant="outlined"
                    onClick={handleAddActivity}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    手順を追加
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          )}

          {activeTab === 3 && (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                危機時対応フローチャート
              </Typography>
              <Typography variant="body2" color="text.secondary">
                BPMNエディタで危機対応手順を設計してください。禁止事項に該当するステップは必ず登録し、赤枠で強調させます。
              </Typography>
              <CrisisFlowchartEditor value={plan.crisisResponseFlow} onChange={onCrisisFlowChange} />
            </Stack>
          )}

          {activeTab === 4 && (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                バージョン管理とモニタリング所見
              </Typography>
              {plan.status !== 'ACTIVE' && (
                <Alert severity="info">
                  アクティブな計画からのみ新しいドラフトを作成できます。先に「計画をアクティブ化」を実行してください。
                </Alert>
              )}
              <TextField
                label="モニタリング所見（前バージョンの成果と課題）"
                multiline
                minRows={4}
                value={monitoringSummary}
                onChange={(event) => setMonitoringSummary(event.target.value)}
                helperText="計画更新時の必須項目です。"
                error={Boolean(monitoringError)}
              />
              {monitoringError && <Alert severity="warning">{monitoringError}</Alert>}
              <Button
                variant="contained"
                color="primary"
                onClick={handleMonitoringSubmission}
                disabled={plan.status !== 'ACTIVE'}
              >
                現行計画を複製して新しいドラフトを作成
              </Button>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default PlanEditor;
