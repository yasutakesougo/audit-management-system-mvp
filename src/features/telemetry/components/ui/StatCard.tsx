export function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `2px solid ${color}20`,
        borderRadius: 12,
        padding: '16px 20px',
        minWidth: 130,
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.2 }}>
        {count}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}
