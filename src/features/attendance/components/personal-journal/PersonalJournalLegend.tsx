import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

export const PersonalJournalLegend: React.FC = () => {
  return (
    <>
      {/* Footer legend */}
      <Box
        sx={{
          mt: 1,
          p: 1,
          border: '1px solid #ccc',
          borderRadius: 0.5,
          bgcolor: '#fafafa',
          fontSize: 10,
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption" component="p" sx={{ fontSize: 10 }}>
          活送迎→○ 家族の送迎→K（車使用→K 電車使用→D バス使用→B 徒歩→T）
        </Typography>
        <Typography variant="caption" component="p" sx={{ fontSize: 10 }}>
          他施設の送迎→他施設の名前 ショートステイ時→SS（明けも書く） 一時ケア→一時ケア
        </Typography>
        <Typography variant="caption" component="p" sx={{ fontSize: 10 }}>
          ※その他遅刻・早退などあったら送迎場所や理由も書く。
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'right' }} data-print="hide">
        ※ 現在はモックデータを表示しています
      </Typography>
    </>
  );
};
