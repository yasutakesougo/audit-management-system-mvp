import React from 'react';

/**
 * Loading fallback for Suspense boundary
 * Shows during lazy component loading (prevents white screen on slow networks)
 * Extracted from main.tsx for reusability.
 */
const SuspenseFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#fafafa',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #5B8C5A',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }}
      />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#666', fontSize: '14px' }}>読み込み中...</p>
    </div>
  </div>
);

export default SuspenseFallback;
