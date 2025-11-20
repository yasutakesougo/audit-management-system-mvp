# UI Text Management Guide

## Overview

This module provides a centralized, type-safe system for managing UI text strings in Japanese. It's designed for maintainability, consistency, and easy internationalization.

## Basic Usage

### Direct Access

```typescript
import { ui } from '@/i18n/ui';

// Basic labels
<h1>{ui.schedule.listTitle}</h1>         // スケジュール一覧
<Button>{ui.schedule.actions.new}</Button> // 新規スケジュール

// Form elements
<DialogTitle>{ui.schedule.form.createTitle}</DialogTitle>
<Button type="submit">{ui.schedule.form.save}</Button>

// State messages
{isLoading && <div>{ui.schedule.state.loading}</div>}
{isEmpty && <div>{ui.schedule.state.empty}</div>}
```

### Type-Safe Helpers

```typescript
import { scheduleUI, filtersUI } from '@/i18n/helpers';

// Recommended approach - better autocomplete and refactoring
<h1>{scheduleUI.title()}</h1>
<Button onClick={handleCreate}>{scheduleUI.actions.new()}</Button>
<Button onClick={handleEdit}>{scheduleUI.actions.edit()}</Button>

// Filter labels
<FormLabel>{filtersUI.scheduleFields.keywordLabel()}</FormLabel>
<FormLabel>{filtersUI.scheduleFields.dateRangeLabel()}</FormLabel>
```

### Dynamic Path Access

```typescript
import { getUIText, type UIPath } from '@/i18n/helpers';

// For dynamic scenarios
const getMessage = (action: 'save' | 'delete'): string => {
  const path: UIPath = action === 'save'
    ? 'schedule.form.successMessage'
    : 'schedule.deleteDialog.successMessage';
  return getUIText(path);
};
```

## Real-World Examples

### Schedule Creation Form

```tsx
import { scheduleUI } from '@/i18n/helpers';

const ScheduleCreateForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog>
      <DialogTitle>{scheduleUI.form.createTitle()}</DialogTitle>

      <DialogContent>
        {/* Form fields */}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>
          {scheduleUI.form.cancel()}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? scheduleUI.form.submitting() : scheduleUI.form.save()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### Delete Confirmation Dialog

```tsx
import { scheduleUI } from '@/i18n/helpers';
import { toast } from 'react-hot-toast';

const ScheduleDeleteDialog = ({ schedule, onClose }: Props) => {
  const handleDelete = async () => {
    try {
      await deleteSchedule(schedule.id);
      toast.success(scheduleUI.deleteDialog.successMessage());
      onClose();
    } catch (error) {
      toast.error(scheduleUI.deleteDialog.errorMessage());
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>{scheduleUI.deleteDialog.title()}</DialogTitle>

      <DialogContent>
        <DialogContentText>
          {scheduleUI.deleteDialog.message()}
        </DialogContentText>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {scheduleUI.deleteDialog.cancel()}
        </Button>
        <Button onClick={handleDelete} color="error">
          {scheduleUI.deleteDialog.confirm()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### Filter Form

```tsx
import { filtersUI } from '@/i18n/helpers';

const ScheduleFilters = () => {
  return (
    <Paper>
      <Typography variant="h6">
        {filtersUI.scheduleFields.heading()}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label={filtersUI.scheduleFields.keywordLabel()}
            fullWidth
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>{filtersUI.scheduleFields.staffLabel()}</InputLabel>
            <Select>{/* options */}</Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>{filtersUI.scheduleFields.statusLabel()}</InputLabel>
            <Select>{/* options */}</Select>
          </FormControl>
        </Grid>
      </Grid>

      <Box mt={2}>
        <Button onClick={handleReset}>
          {filtersUI.scheduleFields.reset()}
        </Button>
        <Button onClick={handleApply} variant="contained">
          {filtersUI.scheduleFields.apply()}
        </Button>
      </Box>
    </Paper>
  );
};
```

### Loading States

```tsx
import { scheduleUI } from '@/i18n/helpers';

const ScheduleList = () => {
  const { data: schedules, isLoading, error } = useSchedules();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
        <Typography ml={2}>{scheduleUI.state.loading()}</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {scheduleUI.state.loadError()}
      </Alert>
    );
  }

  if (!schedules?.length) {
    return (
      <Box textAlign="center" p={4}>
        <Typography color="text.secondary">
          {scheduleUI.state.empty()}
        </Typography>
      </Box>
    );
  }

  return (
    <div>
      <Typography variant="h4" mb={3}>
        {scheduleUI.title()}
      </Typography>

      {/* Schedule list */}
    </div>
  );
};
```

### Toast Notifications

```tsx
import { scheduleUI } from '@/i18n/helpers';
import { toast } from 'react-hot-toast';

const useScheduleActions = () => {
  const createSchedule = async (data: ScheduleData) => {
    try {
      await api.createSchedule(data);
      toast.success(scheduleUI.form.successMessage());
    } catch (error) {
      toast.error(scheduleUI.form.errorMessage());
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await api.deleteSchedule(id);
      toast.success(scheduleUI.deleteDialog.successMessage());
    } catch (error) {
      toast.error(scheduleUI.deleteDialog.errorMessage());
    }
  };

  return { createSchedule, deleteSchedule };
};
```

## Migration from Direct Strings

### Before (Not Recommended)

```tsx
// Hard-coded strings - difficult to maintain
<h1>スケジュール一覧</h1>
<Button>新規スケジュール</Button>
<DialogTitle>スケジュールを削除</DialogTitle>
```

### After (Recommended)

```tsx
import { scheduleUI } from '@/i18n/helpers';

<h1>{scheduleUI.title()}</h1>
<Button>{scheduleUI.actions.new()}</Button>
<DialogTitle>{scheduleUI.deleteDialog.title()}</DialogTitle>
```

### Benefits of Migration

1. **Centralized Management**: All text in one place
2. **Type Safety**: Compile-time checking of text keys
3. **Consistency**: Uniform terminology across the app
4. **Easy Updates**: Change text once, affects everywhere
5. **Future I18n Ready**: Easy to add other languages

## Adding New Text

### 1. Add to UI Object

```typescript
// src/i18n/ui.ts
export const ui = {
  schedule: {
    // ... existing
    newFeature: {
      title: '新機能タイトル',
      description: '新機能の説明',
      action: '新機能を実行',
    },
  },
} as const;
```

### 2. Update Type Definitions

```typescript
// src/i18n/helpers.ts - UIPath type will be auto-updated if using string literal types
// No manual changes needed if structure is properly typed
```

### 3. Add Helper Functions (Optional)

```typescript
// src/i18n/helpers.ts
export const scheduleUI = {
  // ... existing
  newFeature: {
    title: () => ui.schedule.newFeature.title,
    description: () => ui.schedule.newFeature.description,
    action: () => ui.schedule.newFeature.action,
  },
} as const;
```

### 4. Use in Components

```tsx
import { scheduleUI } from '@/i18n/helpers';

<section>
  <h2>{scheduleUI.newFeature.title()}</h2>
  <p>{scheduleUI.newFeature.description()}</p>
  <Button>{scheduleUI.newFeature.action()}</Button>
</section>
```

## Best Practices

### 1. Use Helper Functions

```tsx
// ✅ Good - type-safe and refactorable
import { scheduleUI } from '@/i18n/helpers';
<Button>{scheduleUI.actions.new()}</Button>

// ❌ Avoid - more verbose and error-prone
import { ui } from '@/i18n/ui';
<Button>{ui.schedule.actions.new}</Button>
```

### 2. Group Related Text

```typescript
// ✅ Good - logical grouping
deleteDialog: {
  title: 'タイトル',
  message: 'メッセージ',
  confirm: '確認',
  cancel: 'キャンセル',
}

// ❌ Avoid - scattered organization
title: 'タイトル',
message: 'メッセージ',
confirm: '確認',
```

### 3. Consistent Naming

```typescript
// ✅ Good - clear action labels
actions: {
  new: '新規作成',
  edit: '編集',
  delete: '削除',
  duplicate: '複製',
}

// ❌ Avoid - inconsistent patterns
actions: {
  createNew: '新規作成',
  editItem: '編集',
  remove: '削除',
}
```

### 4. Success/Error Pairs

```typescript
// ✅ Good - consistent messaging
form: {
  successMessage: 'スケジュールを保存しました。',
  errorMessage: 'スケジュールの保存に失敗しました。',
}
```

## Testing UI Text

```typescript
import { describe, it, expect } from 'vitest';
import { scheduleUI } from '@/i18n/helpers';

describe('Schedule UI Text', () => {
  it('should have all required action labels', () => {
    expect(scheduleUI.actions.new()).toContain('新規');
    expect(scheduleUI.actions.edit()).toContain('編集');
    expect(scheduleUI.actions.delete()).toContain('削除');
  });

  it('should have consistent terminology', () => {
    const scheduleTexts = [
      scheduleUI.title(),
      scheduleUI.actions.new(),
      scheduleUI.deleteDialog.title(),
    ];

    scheduleTexts.forEach(text => {
      expect(text).toContain('スケジュール');
    });
  });
});
```

## Backward Compatibility

The current structure maintains full backward compatibility:

```typescript
// Old code continues to work
import { ui } from '@/i18n/ui';
<section aria-label={ui.filters.schedule} />

// New code can use enhanced structure
import { filtersUI } from '@/i18n/helpers';
<FormLabel>{filtersUI.scheduleFields.keywordLabel()}</FormLabel>
```

## Future Enhancements

This system is designed for easy extension:

- **Multiple Languages**: Add `en.ts`, `zh.ts` files
- **Dynamic Loading**: Load text based on user locale
- **Pluralization**: Add plural form support
- **Interpolation**: Add variable substitution
- **Context-Aware**: Different text based on user role

The foundation is ready for these features when needed.
