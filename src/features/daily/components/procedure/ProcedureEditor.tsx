import type { BipOption } from '@/features/daily/domain/toBipOptions';
import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ShieldIcon from '@mui/icons-material/Shield';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';

type ProcedureEditorProps = {
  open: boolean;
  initialItems: ProcedureItem[];
  onClose: () => void;
  onSave: (items: ProcedureItem[]) => void;
  /** 紐付け可能な行動対応プラン（BIP）の選択肢 */
  availablePlans?: BipOption[];
};

const createEmptyItem = (): ProcedureItem => ({
  id: `temp-${Date.now()}`,
  time: '',
  activity: '',
  instruction: '',
  isKey: false,
  linkedInterventionIds: [],
});

export function ProcedureEditor({ open, initialItems, onClose, onSave, availablePlans = [] }: ProcedureEditorProps): JSX.Element {
  const [items, setItems] = useState<ProcedureItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setItems(initialItems.map((item, index) => ({
      ...item,
      id: item.id ?? `step-${index}`,
      linkedInterventionIds: item.linkedInterventionIds ?? [],
    })));
  }, [open, initialItems]);

  const hasValidationError = useMemo(() =>
    items.some((item) => !item.time.trim() || !item.activity.trim()),
  [items]);

  const handleFieldChange = (id: string | undefined, field: keyof ProcedureItem, value: string | boolean) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleLinkedPlansChange = (id: string | undefined, selectedIds: string[]) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, linkedInterventionIds: selectedIds } : item,
      ),
    );
  };

  const handleDelete = (id: string | undefined) => {
    if (!id) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAdd = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleSave = () => {
    const normalized = items
      .filter((item) => item.time.trim() && item.activity.trim())
      .map((item) => ({ ...item, instruction: item.instruction.trim() }));
    normalized.sort((a, b) => a.time.localeCompare(b.time));
    onSave(normalized);
    onClose();
  };

  const hasBipOptions = availablePlans.length > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>支援手順（Plan）の編集</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              まだ手順がありません。下の「手順を追加」から作成してください。
            </Typography>
          )}
          {items.map((item) => {
            const selectedPlans = availablePlans.filter((p) =>
              item.linkedInterventionIds?.includes(p.id),
            );
            return (
            <Box key={item.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                  <TextField
                    label="時間"
                    placeholder="09:00"
                    value={item.time}
                    onChange={(event) => handleFieldChange(item.id, 'time', event.target.value)}
                    size="small"
                    sx={{ flexBasis: { xs: '100%', sm: '25%' } }}
                    fullWidth
                  />
                  <TextField
                    label="本人のやること"
                    placeholder="朝の会"
                    value={item.activity}
                    onChange={(event) => handleFieldChange(item.id, 'activity', event.target.value)}
                    size="small"
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="支援者のやること"
                  placeholder="視覚支援を提示しながら声かけ"
                  value={item.instruction}
                  onChange={(event) => handleFieldChange(item.id, 'instruction', event.target.value)}
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                />

                {/* BIP リンク選択 */}
                {hasBipOptions && (
                  <Autocomplete
                    multiple
                    options={availablePlans}
                    getOptionLabel={(option) => option.label}
                    value={selectedPlans}
                    onChange={(_event, newValue) => {
                      handleLinkedPlansChange(item.id, newValue.map((v) => v.id));
                    }}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    limitTags={2}
                    size="small"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="関連する行動対応プラン（BIP）"
                        placeholder="プランを選択..."
                      />
                    )}
                    renderTags={(tagValue, getTagProps) =>
                      tagValue.map((option, index) => {
                        const { key, ...chipProps } = getTagProps({ index });
                        return (
                          <Chip
                            key={key}
                            {...chipProps}
                            icon={<ShieldIcon />}
                            label={option.label}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        );
                      })
                    }
                    data-testid={`bip-autocomplete-${item.id}`}
                  />
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={item.isKey}
                        onChange={(event) => handleFieldChange(item.id, 'isKey', event.target.checked)}
                        color="warning"
                      />
                    )}
                    label={
                      <Typography variant="body2" fontWeight="bold" color="warning.main">
                        ★ 重要ポイント
                      </Typography>
                    }
                  />
                  <IconButton color="error" size="small" onClick={() => handleDelete(item.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Stack>
            </Box>
          );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd}>
          手順を追加
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={hasValidationError}>
            保存して反映
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default ProcedureEditor;
