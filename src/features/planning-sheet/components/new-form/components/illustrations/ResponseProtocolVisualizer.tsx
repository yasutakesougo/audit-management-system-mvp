import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

interface ResponseProtocolVisualizerProps {
  phase: 'initial' | 'escalated' | 'crisis';
}

export const ResponseProtocolVisualizer: React.FC<ResponseProtocolVisualizerProps> = ({ phase }) => {
  const config = {
    initial: { label: '🟢 初期対応（前兆期）', color: '#10b981', bg: '#ecfdf5', dark: '#064e3b', desc: '落ち着きがなくなる、声が出る等' },
    escalated: { label: '🟡 中期対応（行動発現期）', color: '#f59e0b', bg: '#fffbeb', dark: '#78350f', desc: '大声、座り込み、物への接触等' },
    crisis: { label: '🔴 危機対応（極期）', color: '#ef4444', bg: '#fef2f2', dark: '#7f1d1d', desc: '自傷、他害、激しい破壊等' },
  }[phase];

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Paper variant="outlined" sx={{ p: 2, borderLeft: `6px solid ${config.color}`, bgcolor: config.bg, borderRadius: '8px 16px 16px 8px' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ 
            width: 48, height: 48, borderRadius: '50%', bgcolor: config.color, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' 
          }}>
            {phase === 'initial' && '🟢'}
            {phase === 'escalated' && '🟡'}
            {phase === 'crisis' && '🔴'}
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} color={config.dark}>{config.label}</Typography>
            <Typography variant="caption" color={config.dark} sx={{ opacity: 0.8 }}>{config.desc}</Typography>
          </Box>
        </Stack>
      </Paper>
      
      {/* 迷わないための指示構造 */}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Box sx={{ flex: 1, p: 1, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">判断せずに動く</Typography>
        </Box>
        <Box sx={{ flex: 1, p: 1, bgcolor: '#fef2f2', borderRadius: 2, border: '1px dashed #fecaca', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={700} color="error.main">NG行動の徹底回避</Typography>
        </Box>
      </Stack>
    </Box>
  );
};

export default ResponseProtocolVisualizer;
