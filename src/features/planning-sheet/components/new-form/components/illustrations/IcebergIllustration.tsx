import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ICEBERG_FACTORS } from '../../constants';

interface IcebergIllustrationProps {
  surfaceValue?: string;
}

export const IcebergIllustration: React.FC<IcebergIllustrationProps> = ({ surfaceValue }) => (
  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 6 }}>
    <Box sx={{
      width: '100%',
      maxWidth: 600,
      bgcolor: '#f8fbff',
      borderRadius: 4,
      p: { xs: 2, sm: 4 },
      pb: { xs: 3, sm: 5 },
      border: '1px solid #e0f2fe',
      boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <svg
        viewBox="0 0 520 400"
        width="100%"
        height="auto"
        role="img"
        aria-label="氷山分析の構造図"
        style={{ display: 'block', maxWidth: '520px' }}
      >
        {/* タイトル */}
        <text x="260" y="30" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0c4a6e">氷山分析</text>

        {/* 水面上：問題行動 */}
        <rect x="100" y="50" width="320" height="56" rx="16" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
        <text x="260" y="86" textAnchor="middle" fontSize={surfaceValue && surfaceValue.length > 15 ? 14 : 18} fontWeight="700" fill="#78350f">
          {surfaceValue 
            ? (surfaceValue.length > 22 ? surfaceValue.substring(0, 20) + '...' : surfaceValue)
            : '🏔️ 問題行動（水面上）'
          }
        </text>

        {/* 水面ライン */}
        <line x1="30" y1="130" x2="490" y2="130" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        <text x="490" y="122" textAnchor="end" fontSize="12" fontWeight="700" fill="#0369a1">水面</text>

        {/* 氷山本体 */}
        <path d="M120 150 L400 150 L460 380 L60 380 Z" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />

        {/* 層区切り */}
        <line x1="105" y1="195" x2="415" y2="195" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="90" y1="240" x2="430" y2="240" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="75" y1="285" x2="445" y2="285" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="65" y1="330" x2="455" y2="330" stroke="#bfdbfe" strokeWidth="1.5" />

        {/* ラベル */}
        <text x="260" y="180" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[1].icon} {ICEBERG_FACTORS[1].label}</text>
        <text x="260" y="225" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[2].icon} {ICEBERG_FACTORS[2].label}</text>
        <text x="260" y="270" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[3].icon} {ICEBERG_FACTORS[3].label}</text>
        <text x="260" y="315" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[4].icon} {ICEBERG_FACTORS[4].label}</text>
        <text x="260" y="362" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1d4ed8">{ICEBERG_FACTORS[5].icon} {ICEBERG_FACTORS[5].label}</text>
      </svg>
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary', fontStyle: 'italic', px: 2 }}>
        表面に見える行動の下に、背景要因や本人の願いが重なっています。
      </Typography>
    </Box>
  </Box>
);

export default IcebergIllustration;
