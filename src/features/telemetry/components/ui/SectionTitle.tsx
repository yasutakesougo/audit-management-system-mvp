import React from 'react';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 13,
      fontWeight: 600,
      color: '#64748b',
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
      margin: '0 0 14px 0',
    }}>
      {children}
    </h2>
  );
}
