import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import type {
  DailyStatus,
  MealAmount,
  PersonDaily,
  ProblemBehavior,
  SeizureRecord,
} from '../../domain/daily/types';

type DailyRecordFormProps = {
  record: PersonDaily | null;
  onSave: (nextRecord: PersonDaily) => void;
  onCancel?: () => void;
};

type FormState = {
  status: DailyStatus;
  reporterName: string;
  amActivities: string;
  pmActivities: string;
  amNotes: string;
  pmNotes: string;
  mealAmount: MealAmount | '';
  specialNotes: string;
  problemBehavior: ProblemBehavior;
  seizureRecord: SeizureRecord;
};

const mealAmountOptions: MealAmount[] = ['完食', '多め', '半分', '少なめ', 'なし'];

const toFormState = (record: PersonDaily): FormState => ({
  status: record.status,
  reporterName: record.reporter.name,
  amActivities: record.data.amActivities.join('\n'),
  pmActivities: record.data.pmActivities.join('\n'),
  amNotes: record.data.amNotes ?? '',
  pmNotes: record.data.pmNotes ?? '',
  mealAmount: record.data.mealAmount ?? '',
  specialNotes: record.data.specialNotes ?? '',
  problemBehavior: {
    selfHarm: record.data.problemBehavior?.selfHarm ?? false,
    violence: record.data.problemBehavior?.violence ?? false,
    loudVoice: record.data.problemBehavior?.loudVoice ?? false,
    pica: record.data.problemBehavior?.pica ?? false,
    other: record.data.problemBehavior?.other ?? false,
    otherDetail: record.data.problemBehavior?.otherDetail ?? '',
  },
  seizureRecord: {
    occurred: record.data.seizureRecord?.occurred ?? false,
    time: record.data.seizureRecord?.time ?? '',
    duration: record.data.seizureRecord?.duration ?? '',
    severity: record.data.seizureRecord?.severity,
    notes: record.data.seizureRecord?.notes ?? '',
  },
});

const toActivities = (value: string): string[] =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export function DailyRecordForm({ record, onSave, onCancel }: DailyRecordFormProps) {
  const [formState, setFormState] = useState<FormState | null>(() => (record ? toFormState(record) : null));

  useEffect(() => {
    setFormState(record ? toFormState(record) : null);
  }, [record]);

  const hasProblemBehavior = useMemo(
    () =>
      !!formState &&
      (formState.problemBehavior.selfHarm ||
        formState.problemBehavior.violence ||
        formState.problemBehavior.loudVoice ||
        formState.problemBehavior.pica ||
        formState.problemBehavior.other),
    [formState],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  };

  if (!record || !formState) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">利用者をサイドメニューから選択してください。</Typography>
      </Box>
    );
  }

  const canSave = formState.reporterName.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) {
      return;
    }
    const nextRecord: PersonDaily = {
      ...record,
      status: formState.status,
      reporter: {
        ...record.reporter,
        name: formState.reporterName.trim(),
      },
      draft: {
        ...record.draft,
        isDraft: formState.status !== '完了',
      },
      data: {
        ...record.data,
        amActivities: toActivities(formState.amActivities),
        pmActivities: toActivities(formState.pmActivities),
        amNotes: formState.amNotes,
        pmNotes: formState.pmNotes,
        mealAmount: formState.mealAmount || undefined,
        problemBehavior: {
          ...formState.problemBehavior,
          otherDetail: formState.problemBehavior.other ? formState.problemBehavior.otherDetail : undefined,
        },
        seizureRecord: {
          ...formState.seizureRecord,
          time: formState.seizureRecord.time || undefined,
          duration: formState.seizureRecord.duration || undefined,
          severity: formState.seizureRecord.severity || undefined,
          notes: formState.seizureRecord.notes || undefined,
        },
        specialNotes: formState.specialNotes,
      },
    };

    onSave(nextRecord);
  };

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
    >
      <Stack spacing={3} sx={{ px: 1, pb: 2 }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {record.personName} さんの日次記録
          </Typography>
          <Typography variant="body2" color="text.secondary">
            対象日: {record.date}
          </Typography>
        </Box>

        <ToggleButtonGroup
          exclusive
          color="primary"
          value={formState.status}
          onChange={(_, value: DailyStatus | null) => {
            if (!value) return;
            setFormState((prev) => (prev ? { ...prev, status: value } : prev));
          }}
        >
          <ToggleButton value="未作成">未作成</ToggleButton>
          <ToggleButton value="作成中">作成中</ToggleButton>
          <ToggleButton value="完了">完了</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          label="記録者"
          value={formState.reporterName}
          onChange={(event) =>
            setFormState((prev) => (prev ? { ...prev, reporterName: event.target.value } : prev))
          }
          fullWidth
          required
        />

        <Divider />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="午前の活動"
            multiline
            minRows={3}
            value={formState.amActivities}
            onChange={(event) =>
              setFormState((prev) => (prev ? { ...prev, amActivities: event.target.value } : prev))
            }
            helperText="改行またはカンマで複数入力できます"
            fullWidth
          />
          <TextField
            label="午後の活動"
            multiline
            minRows={3}
            value={formState.pmActivities}
            onChange={(event) =>
              setFormState((prev) => (prev ? { ...prev, pmActivities: event.target.value } : prev))
            }
            helperText="改行またはカンマで複数入力できます"
            fullWidth
          />
        </Stack>

        <Stack spacing={2}>
          <TextField
            label="午前メモ"
            multiline
            minRows={2}
            value={formState.amNotes}
            onChange={(event) =>
              setFormState((prev) => (prev ? { ...prev, amNotes: event.target.value } : prev))
            }
            fullWidth
          />
          <TextField
            label="午後メモ"
            multiline
            minRows={2}
            value={formState.pmNotes}
            onChange={(event) =>
              setFormState((prev) => (prev ? { ...prev, pmNotes: event.target.value } : prev))
            }
            fullWidth
          />
        </Stack>

        <FormControl fullWidth>
          <InputLabel id="meal-amount-label">食事摂取量</InputLabel>
          <Select
            labelId="meal-amount-label"
            label="食事摂取量"
            value={formState.mealAmount}
            onChange={(event) =>
              setFormState((prev) =>
                prev ? { ...prev, mealAmount: (event.target.value as MealAmount) || '' } : prev,
              )
            }
          >
            <MenuItem value="">
              <em>未選択</em>
            </MenuItem>
            {mealAmountOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box>
          <Typography variant="subtitle1" gutterBottom>
            問題行動
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.problemBehavior.selfHarm}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? { ...prev, problemBehavior: { ...prev.problemBehavior, selfHarm: event.target.checked } }
                        : prev,
                    )
                  }
                />
              }
              label="自傷"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.problemBehavior.violence}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? { ...prev, problemBehavior: { ...prev.problemBehavior, violence: event.target.checked } }
                        : prev,
                    )
                  }
                />
              }
              label="暴力"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.problemBehavior.loudVoice}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? { ...prev, problemBehavior: { ...prev.problemBehavior, loudVoice: event.target.checked } }
                        : prev,
                    )
                  }
                />
              }
              label="大声"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.problemBehavior.pica}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? { ...prev, problemBehavior: { ...prev.problemBehavior, pica: event.target.checked } }
                        : prev,
                    )
                  }
                />
              }
              label="異食"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.problemBehavior.other}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? {
                            ...prev,
                            problemBehavior: { ...prev.problemBehavior, other: event.target.checked },
                          }
                        : prev,
                    )
                  }
                />
              }
              label="その他"
            />
          </FormGroup>
          {hasProblemBehavior && (
            <TextField
              label="詳細メモ"
              multiline
              minRows={2}
              value={formState.problemBehavior.otherDetail ?? ''}
              onChange={(event) =>
                setFormState((prev) =>
                  prev
                    ? {
                        ...prev,
                        problemBehavior: { ...prev.problemBehavior, otherDetail: event.target.value },
                      }
                    : prev,
                )
              }
              fullWidth
              sx={{ mt: 2 }}
            />
          )}
        </Box>

        <Box>
          <Typography variant="subtitle1" gutterBottom>
            発作記録
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.seizureRecord.occurred}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? {
                            ...prev,
                            seizureRecord: { ...prev.seizureRecord, occurred: event.target.checked },
                          }
                        : prev,
                    )
                  }
                />
              }
              label="発作あり"
            />
          </FormGroup>
          {formState.seizureRecord.occurred && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="発生時刻"
                value={formState.seizureRecord.time ?? ''}
                onChange={(event) =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          seizureRecord: { ...prev.seizureRecord, time: event.target.value },
                        }
                      : prev,
                  )
                }
                placeholder="14:30 など"
              />
              <TextField
                label="持続時間"
                value={formState.seizureRecord.duration ?? ''}
                onChange={(event) =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          seizureRecord: { ...prev.seizureRecord, duration: event.target.value },
                        }
                      : prev,
                  )
                }
                placeholder="約3分 など"
              />
              <TextField
                label="重症度"
                value={formState.seizureRecord.severity ?? ''}
                onChange={(event) =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          seizureRecord: {
                            ...prev.seizureRecord,
                            severity: (event.target.value || undefined) as SeizureRecord['severity'],
                          },
                        }
                      : prev,
                  )
                }
                placeholder="軽度 / 中等度 / 重度"
              />
              <TextField
                label="メモ"
                multiline
                minRows={2}
                value={formState.seizureRecord.notes ?? ''}
                onChange={(event) =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          seizureRecord: { ...prev.seizureRecord, notes: event.target.value },
                        }
                      : prev,
                  )
                }
                fullWidth
              />
            </Stack>
          )}
        </Box>

        <TextField
          label="特記事項"
          multiline
          minRows={3}
          value={formState.specialNotes}
          onChange={(event) =>
            setFormState((prev) => (prev ? { ...prev, specialNotes: event.target.value } : prev))
          }
          fullWidth
        />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {onCancel && (
            <Button variant="outlined" onClick={onCancel}>
              取り消し
            </Button>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={!canSave}
            type="button"
          >
            保存して次へ
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
