import ClearRounded from '@mui/icons-material/ClearRounded';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';

export type StatusOption = { value: string; label: string };

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  debounceMs?: number;
  statusOptions?: StatusOption[];
  activeStatus?: string;
  onStatusChange?: (value: string) => void;
  extraControls?: ReactNode;
  onReset?: () => void;
  isResetDisabled?: boolean;
  children?: ReactNode;
  searchLabel?: string;
  searchPlaceholder?: string;
  helperText?: string;
  searchHelpId?: string;
  toolbarLabel?: string;
  trailingControls?: ReactNode;
  debounceState?: 'idle' | 'busy';
  statusGroupLabel?: string;
  extraControlsLabel?: string;
  scope?: string;
};

export default function FilterToolbar({
  query,
  onQueryChange,
  debounceMs = 300,
  statusOptions,
  activeStatus,
  onStatusChange,
  extraControls,
  onReset,
  isResetDisabled,
  children,
  searchLabel = '検索',
  searchPlaceholder = 'キーワード',
  helperText,
  searchHelpId,
  toolbarLabel = '検索条件',
  trailingControls,
  debounceState,
  statusGroupLabel = '状態',
  extraControlsLabel = '期間',
  scope,
}: Props) {
  const [inputValue, setInputValue] = useState(query);

  useEffect(() => {
    setInputValue((prev) => (prev === query ? prev : query));
  }, [query]);

  const hasQuery = inputValue.trim().length > 0;
  const resolvedHelperText = helperText ?? `入力停止後に自動検索（約${debounceMs}ms）`;
  const generatedHelpId = useId();
  const helperTextId = searchHelpId ?? `${generatedHelpId}-help`;

  // NOTE:
  // debounceMs は helperText の文言表示専用パラメータです。
  // 実際のデバウンス処理は親コンポーネント側で onQueryChange をラップして行う想定。
  const updateQuery = useCallback(
    (nextValue: string) => {
      setInputValue(nextValue);
      onQueryChange(nextValue);
    },
    [onQueryChange]
  );

  const buttons = useMemo(() => {
    const list = statusOptions ?? [];
    return list.map((option) => (
      <Button
        key={option.value}
        size="small"
        variant={activeStatus === option.value ? 'contained' : 'outlined'}
        color="secondary"
        onClick={() => onStatusChange?.(option.value)}
        aria-pressed={activeStatus === option.value}
        type="button"
      >
        {option.label}
      </Button>
    ));
  }, [statusOptions, activeStatus, onStatusChange]);

  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div
        className="flex flex-wrap items-center gap-3"
        role="toolbar"
        aria-label={toolbarLabel}
        aria-busy={debounceState === 'busy' ? true : undefined}
        data-debounced={debounceState}
        data-filter-toolbar="true"
        data-scope={scope}
      >
        <TextField
          size="small"
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={inputValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            const native = event.nativeEvent as { isComposing?: boolean };
            if (native?.isComposing) {
              setInputValue(nextValue);
              return;
            }
            updateQuery(nextValue);
          }}
          onCompositionEnd={(event) => {
            const nextValue = (event.currentTarget as HTMLInputElement).value;
            updateQuery(nextValue);
          }}
          helperText={resolvedHelperText}
          FormHelperTextProps={{ id: helperTextId, sx: { m: 0 } }}
          inputProps={{ 'aria-describedby': helperTextId, 'data-focus-order': '1' }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="検索条件をクリア"
                  title="検索条件をクリア"
                  onClick={() => {
                    updateQuery('');
                  }}
                  disabled={!hasQuery}
                  data-filter-action="clear-search"
                >
                  <ClearRounded fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {!!statusOptions?.length && (
          <fieldset
            role="group"
            aria-label={statusGroupLabel}
            className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
            data-focus-order="2"
          >
            {buttons}
          </fieldset>
        )}

        {extraControls ? (
          <fieldset
            role="group"
            aria-label={extraControlsLabel}
            data-focus-order="3"
            className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
          >
            {extraControls}
          </fieldset>
        ) : null}

        {onReset && (
          <Button
            size="small"
            variant="text"
            onClick={onReset}
            disabled={!!isResetDisabled}
            title={isResetDisabled ? 'リセットできる条件がありません' : '条件をリセット'}
            type="button"
            data-focus-order="4"
            data-filter-action="reset"
          >
            条件をリセット
          </Button>
        )}

        {trailingControls ? (
          <div data-focus-order="5" className="flex flex-wrap items-center gap-2">
            {trailingControls}
          </div>
        ) : null}
      </div>
      {children ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
