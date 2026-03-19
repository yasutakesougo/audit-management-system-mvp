import React from 'react';

export function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        marginBottom: 20,
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}
