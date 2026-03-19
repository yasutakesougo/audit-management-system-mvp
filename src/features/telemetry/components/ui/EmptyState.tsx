export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>
      {message}
    </div>
  );
}
