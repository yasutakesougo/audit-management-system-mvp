import React, { KeyboardEvent, ReactNode } from 'react';

type CommonProps = {
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
};

export type A11yListProps = CommonProps & {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  role?: 'list';
};

export function A11yList(props: A11yListProps) {
  const { className, style, children, ariaLabel, ariaLabelledBy } = props;
  return (
    <div
      role="list"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

export type A11yListItemProps = CommonProps & {
  role?: 'listitem';
  /**
   * Optional trailing action rendered as a sibling to the main row content.
   * Use this to place menus or icon buttons that shouldn't be nested inside the row button.
   */
  trailingAction?: ReactNode;
};

export function A11yListItem(props: A11yListItemProps) {
  const { className, style, children, trailingAction } = props;
  return (
    <div role="listitem" className={className} style={style}>
      {children}
      {trailingAction}
    </div>
  );
}

export type A11yRowButtonProps = CommonProps & {
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  tabIndex?: number;
};

/**
 * Keyboard-friendly button built on a div for cases where native <button> cannot be used.
 * - Adds role="button" and manages Enter/Space activation.
 * - Sets tabIndex=0 when enabled, -1 when disabled.
 */
export function A11yRowButton(props: A11yRowButtonProps) {
  const { className, style, children, disabled, ariaLabel, ariaDescribedBy, onClick, onKeyDown, tabIndex } = props;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (onKeyDown) onKeyDown(e);
    if (e.defaultPrevented) return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      // Prevent page scroll on Space
      e.preventDefault();
      if (onClick) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick((e as unknown) as any);
      }
    } else if (e.key === 'Enter') {
      if (onClick) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick((e as unknown) as any);
      }
    }
  };

  return (
    <div
      role="button"
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={className}
      style={style}
      onClick={disabled ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClick}
      onKeyDown={handleKeyDown}
      tabIndex={typeof tabIndex === 'number' ? tabIndex : disabled ? -1 : 0}
    >
      {children}
    </div>
  );
}

export type { KeyboardEvent };
