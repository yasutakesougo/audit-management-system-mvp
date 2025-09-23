import React from 'react';

const ErrorState: React.FC<{ message?: string }> = ({ message }) => (
  <div style={{ color: 'red', textAlign: 'center', padding: '2rem' }}>
    <span>{message || 'エラーが発生しました'}</span>
  </div>
);

export default ErrorState;
