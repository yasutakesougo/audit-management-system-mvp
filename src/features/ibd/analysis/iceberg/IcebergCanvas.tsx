import { IcebergCard } from '@/features/ibd/analysis/iceberg/IcebergCard';
import type { HypothesisLink, IcebergNode, NodePosition } from '@/features/ibd/analysis/iceberg/icebergTypes';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { TESTIDS, tid, tidWithSuffix } from '@/testids';
import { alpha } from '@mui/material/styles';
import React, { useRef, useState } from 'react';

type Props = {
  nodes: IcebergNode[];
  links: HypothesisLink[];
  onMoveNode: (id: string, position: NodePosition) => void;
  onSelectNode?: (id: string | null) => void;
  onSelectLink?: (id: string | null) => void;
  onAddNode?: (position: NodePosition) => void;
  selectedNodeId?: string | null;
  selectedLinkId?: string | null;
  isMeetingMode?: boolean;
};

const CARD_WIDTH = 220;
const CARD_HEIGHT = 120;

export const IcebergCanvas: React.FC<Props> = ({ 
  nodes, links, onMoveNode, onSelectNode, onSelectLink, onAddNode,
  selectedNodeId: externalSelectedId, selectedLinkId: externalSelectedLinkId,
  isMeetingMode 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  
  const selectedId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;

  const setSelectedId = (id: string | null) => {
    setInternalSelectedId(id);
    onSelectNode?.(id);
    if (id) {
      onSelectLink?.(null);
    }
  };

  const [internalSelectedLinkId, setInternalSelectedLinkId] = useState<string | null>(null);
  const selectedLinkId = externalSelectedLinkId !== undefined ? externalSelectedLinkId : internalSelectedLinkId;

  const setSelectedLinkId = (id: string | null) => {
    setInternalSelectedLinkId(id);
    onSelectLink?.(id);
    if (id) {
      setSelectedId(null);
    }
  };
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const getRelativePosition = (event: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event: React.PointerEvent, nodeId: string) => {
    event.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const { x, y } = getRelativePosition(event);
    setOffset({ x: x - node.position.x, y: y - node.position.y });
    setDraggingId(nodeId);
    setSelectedId(nodeId);
    (event.target as Element).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!draggingId) return;
    const relative = getRelativePosition(event);
    const newX = relative.x - offset.x;
    const newY = relative.y - offset.y;
    onMoveNode(draggingId, { x: newX, y: newY });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (draggingId) {
      setDraggingId(null);
    }
    try {
      (event.target as Element).releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors when pointer not captured
    }
  };

  const renderLinks = () =>
    links.map((link) => {
      const source = nodes.find((node) => node.id === link.sourceNodeId);
      const target = nodes.find((node) => node.id === link.targetNodeId);
      if (!source || !target) return null;

      const x1 = source.position.x + CARD_WIDTH / 2;
      const y1 = source.position.y + CARD_HEIGHT / 2;
      const x2 = target.position.x + CARD_WIDTH / 2;
      const y2 = target.position.y + CARD_HEIGHT / 2;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // 線種と太さの設定 (因果関係の強さ/合意形成の段階を表現)
      const lineStyle = (() => {
        const baseWidth = isMeetingMode ? 1.5 : 1;
        const isValidated = link.status === 'validated';
        
        // Use status-based rendering logic
        if (isValidated) {
          return { 
            strokeWidth: (link.confidence === 'high' ? 5 : 3) * baseWidth, 
            dash: 'none', 
            opacity: 0.9, 
            label: '検証済み',
            color: '#0d47a1', // Dark blue for validated
            glow: true
          };
        } else {
          // Hypothesis styles
          switch (link.confidence) {
            case 'high':
              return { strokeWidth: 4 * baseWidth, dash: '8 4', opacity: 0.7, label: '実証済み仮説', color: '#455a64', glow: true };
            case 'medium':
              return { strokeWidth: 2.5 * baseWidth, dash: '6 3', opacity: 0.5, label: '有力な仮説', color: '#455a64', glow: false };
            case 'low':
            default:
              return { strokeWidth: 1.5 * baseWidth, dash: '4 4', opacity: 0.3, label: '仮説段階', color: '#455a64', glow: false };
          }
        }
      })();

      const isLinkSelected = selectedLinkId === link.id;

      return (
        <g 
          key={link.id} 
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLinkId(link.id);
          }}
          {...tidWithSuffix(TESTIDS['iceberg-link-item'], link.id)}
        >
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Hit area (wider invisible line) */}
          <line 
            x1={x1} y1={y1} x2={x2} y2={y2} 
            stroke="transparent" 
            strokeWidth={15} 
          />
          <line 
            x1={x1} y1={y1} x2={x2} y2={y2} 
            stroke={isLinkSelected ? '#1976d2' : alpha(lineStyle.color, lineStyle.opacity)} 
            strokeWidth={isLinkSelected ? lineStyle.strokeWidth + 2 : lineStyle.strokeWidth} 
            strokeDasharray={lineStyle.dash}
            style={{ 
              filter: (lineStyle.glow || isLinkSelected) ? 'url(#glow)' : 'none', 
              transition: 'all 0.3s ease',
            }}
          />
          
          {/* Label for Meeting Mode */}
          {isMeetingMode && (isLinkSelected || link.confidence === 'high') && (
            <foreignObject x={midX - 40} y={midY - 12} width={80} height={24}>
              <Box 
                sx={{ 
                  bgcolor: alpha(isLinkSelected ? '#1976d2' : '#455a64', 0.9), 
                  color: 'white', 
                  fontSize: '0.6rem', 
                  textAlign: 'center', 
                  borderRadius: 1,
                  py: 0.25,
                  boxShadow: 2,
                  fontWeight: 'bold',
                }}
              >
                {lineStyle.label}
              </Box>
            </foreignObject>
          )}
        </g>
      );
    });

  return (
    <Box
      ref={containerRef}
      {...tid(TESTIDS['iceberg-canvas'])}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #f0f7ff 0%, #e1f5fe 40%, #b3e5fc 100%)',
        border: '1px solid #e1f5fe',
        borderRadius: 4,
        touchAction: 'none',
        boxShadow: 'inset 0 0 40px rgba(255,255,255,0.5)',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => {
        if (isMeetingMode) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        onAddNode?.({
          x: e.clientX - rect.left - CARD_WIDTH / 2,
          y: e.clientY - rect.top - CARD_HEIGHT / 2,
        });
      }}
      onClick={() => {
        setSelectedId(null);
        setSelectedLinkId(null);
      }}
    >
      {/* Legend */}
      <Box 
        sx={{ position: 'absolute', top: 16, left: 16, zIndex: 20, pointerEvents: 'none' }}
        {...tid(TESTIDS['iceberg-legend'])}
      >
        <Stack direction="row" spacing={1}>
          <Chip label="行動 (結果)" size="small" sx={{ bgcolor: alpha('#ffebee', 0.9), border: '1px solid #ffc1cc', fontWeight: 'bold', fontSize: '0.65rem' }} />
          <Chip label="内的要因" size="small" sx={{ bgcolor: alpha('#f0f7ff', 0.9), border: '1px solid #b3d7ff', fontWeight: 'bold', fontSize: '0.65rem' }} />
          <Chip label="環境要因" size="small" sx={{ bgcolor: alpha('#f4fff4', 0.9), border: '1px solid #b9e5b9', fontWeight: 'bold', fontSize: '0.65rem' }} />
        </Stack>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: '40%',
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, rgba(2,136,209,0) 0%, rgba(2,136,209,0.5) 50%, rgba(2,136,209,0) 100%)',
          zIndex: 5,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        {...tid(TESTIDS['iceberg-waterline'])}
      >
        <Box 
          sx={{ 
            bgcolor: alpha('#0288d1', 0.08), 
            px: 2, 
            py: 0.5, 
            borderRadius: 10, 
            border: '1px dashed #0288d1',
            backdropFilter: 'blur(2px)',
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: '#01579b', fontWeight: 'bold', letterSpacing: '0.1em' }}
          >
            WATERLINE (水面)
          </Typography>
        </Box>
      </Box>

      <svg
        {...tid(TESTIDS['iceberg-links'])}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
      >
        {renderLinks()}
      </svg>

      {nodes.map((node) => (
        <IcebergCard
          key={node.id}
          node={node}
          isSelected={selectedId === node.id}
          onPointerDown={isMeetingMode ? () => {} : handlePointerDown}
          onSelect={setSelectedId}
          isMeetingMode={isMeetingMode}
        />
      ))}
    </Box>
  );
};
