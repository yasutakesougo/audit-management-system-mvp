import React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LightbulbCircleIcon from '@mui/icons-material/LightbulbCircle';
import SourceIcon from '@mui/icons-material/Source';
import type { MonitoringToPlanningBridge, PlanningCandidate } from '@/domain/isp/bridge';

interface BridgeSuggestionsSectionProps {
  bridge: MonitoringToPlanningBridge | null;
  isEditing: boolean;
  onReflectCandidate: (candidateId: string) => void;
}

export const BridgeSuggestionsSection: React.FC<BridgeSuggestionsSectionProps> = ({
  bridge,
  isEditing,
  onReflectCandidate,
}) => {
  if (!bridge || bridge.candidates.length === 0) return null;

  const { candidates, reassessmentSignal } = bridge;

  return (
    <Box sx={{ mb: 3 }}>
      {reassessmentSignal.isRequired && (
        <Alert severity={reassessmentSignal.priority === 'high' ? 'error' : 'warning'} sx={{ mb: 2 }}>
          <AlertTitle>モニタリングによる再評価の推奨</AlertTitle>
          {reassessmentSignal.reason}
        </Alert>
      )}

      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'primary.main' }}>
        <LightbulbCircleIcon fontSize="small" />
        モニタリングからの計画修正案 ({candidates.length}件)
      </Typography>

      <Stack spacing={1}>
        {candidates.map((candidate) => (
          <CandidateCard 
            key={candidate.id} 
            candidate={candidate} 
            isEditing={isEditing} 
            onReflect={() => onReflectCandidate(candidate.id)} 
          />
        ))}
      </Stack>
    </Box>
  );
};

const CandidateCard: React.FC<{ 
  candidate: PlanningCandidate; 
  isEditing: boolean;
  onReflect: () => void;
}> = ({ 
  candidate, 
  isEditing,
  onReflect
}) => {
  const typeLabel = {
    observation: '行動観察',
    hypothesis: '背景仮説',
    environmental: '環境調整',
    strategy: '関わり方',
    risk: 'リスク',
  }[candidate.type];

  return (
    <Card variant="outlined" sx={{ bgcolor: 'action.hover', borderStyle: 'dashed' }}>
      <CardContent sx={{ p: '12px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip 
              label={typeLabel} 
              size="small" 
              color="primary" 
              variant="outlined" 
              sx={{ height: 20, fontSize: '0.65rem' }} 
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SourceIcon sx={{ fontSize: 12 }} />
              {candidate.provenance.sourceType} ({candidate.provenance.observedAt})
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: candidate.confidence > 0.8 ? 'success.main' : 'text.secondary' }}>
            確信度: {Math.round(candidate.confidence * 100)}%
          </Typography>
        </Box>
        
        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
          {candidate.content}
        </Typography>
        
        <Typography variant="caption" color="text.secondary">
          根拠: {candidate.reason}
        </Typography>

        {isEditing && (
          <Box sx={{ mt: 1, textAlign: 'right' }}>
            <Typography 
              variant="caption" 
              color="primary" 
              onClick={(e) => {
                e.stopPropagation();
                onReflect();
              }}
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              この提案を反映する
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
