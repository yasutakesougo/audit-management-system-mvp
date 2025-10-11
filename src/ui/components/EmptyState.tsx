type EmptyStateProps = {
  title?: string;
  description?: string;
  'data-testid'?: string;
};

export default function EmptyState({
  title = '表示できる項目がありません',
  description = '条件や期間を変更して、もう一度お試しください。',
  'data-testid': testId = 'empty-state',
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      aria-live="polite"
      className="empty-state"
      style={{
        border: '1px dashed rgba(0,0,0,0.15)',
        borderRadius: 12,
        padding: '16px 20px',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'rgba(0,0,0,0.6)' }}>{description}</div>
    </div>
  );
}
