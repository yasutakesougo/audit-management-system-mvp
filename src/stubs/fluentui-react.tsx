import React from 'react';

type MessageBarProps = React.PropsWithChildren<{
  messageBarType?: MessageBarTypeKey;
  isMultiline?: boolean;
}>;

type MessageBarTypeKey = keyof typeof MessageBarType;

export const MessageBarType = {
  info: 'info',
  error: 'error',
  warning: 'warning',
  severeWarning: 'severeWarning',
  blocked: 'blocked',
  success: 'success',
} as const;

export const MessageBar: React.FC<MessageBarProps> = ({ children }) => (
  <div data-testid="fluentui-message-bar">{children}</div>
);

export default {
  MessageBar,
  MessageBarType,
};
