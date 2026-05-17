import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

interface ABCIllustrationProps {
  a?: string;
  b?: string;
  c?: string;
}

export const ABCIllustration: React.FC<ABCIllustrationProps> = ({ a, b, c }) => (
  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 4 }}>
    <Box sx={{
      width: '100%',
      maxWidth: 700,
      bgcolor: '#fff',
      borderRadius: 4,
      p: { xs: 2, sm: 3 },
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
        {/* A: Antecedent */}
        <Box sx={{ flex: 1, minHeight: 120, p: 2, borderRadius: 3, border: '2px solid #93c5fd', bgcolor: '#f0f9ff', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={800} color="primary.main" gutterBottom sx={{ fontSize: '0.65rem', borderBottom: '1px solid currentColor', mb: 1, px: 1 }}>A: 先行事象</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#1e3a8a', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {a || '（行動の直前の状況）'}
          </Typography>
        </Box>

        <Box sx={{ color: '#cbd5e1', fontWeight: 900 }}>▶</Box>

        {/* B: Behavior */}
        <Box sx={{ flex: 1, minHeight: 120, p: 2, borderRadius: 3, border: '2px solid #fecaca', bgcolor: '#fef2f2', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={800} color="error.main" gutterBottom sx={{ fontSize: '0.65rem', borderBottom: '1px solid currentColor', mb: 1, px: 1 }}>B: 行動</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#7f1d1d', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {b || '（具体的な行動の内容）'}
          </Typography>
        </Box>

        <Box sx={{ color: '#cbd5e1', fontWeight: 900 }}>▶</Box>

        {/* C: Consequence */}
        <Box sx={{ flex: 1, minHeight: 120, p: 2, borderRadius: 3, border: '2px solid #bbf7d0', bgcolor: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={800} color="success.main" gutterBottom sx={{ fontSize: '0.65rem', borderBottom: '1px solid currentColor', mb: 1, px: 1 }}>C: 結果</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#064e3b', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {c || '（行動のあとの変化）'}
          </Typography>
        </Box>
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mt: 2, textAlign: 'center', color: 'text.secondary', fontWeight: 500 }}>
        この連鎖（A→B→C）から、なぜその行動が繰り返されるのか（機能）を推測します。
      </Typography>
    </Box>
  </Box>
);

export default ABCIllustration;
