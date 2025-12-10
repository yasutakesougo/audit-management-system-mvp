import { IcebergCard } from '@/features/analysis/components/iceberg/IcebergCard';
import type { HypothesisLink, IcebergNode, NodePosition } from '@/features/analysis/domain/icebergTypes';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React, { useRef, useState } from 'react';

type Props = {
  nodes: IcebergNode[];
  links: HypothesisLink[];
  onMoveNode: (id: string, position: NodePosition) => void;
};

const CARD_WIDTH = 220;
const CARD_HEIGHT = 120;

export const IcebergCanvas: React.FC<Props> = ({ nodes, links, onMoveNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

      return (
        <g key={link.id}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#90a4ae" strokeWidth={2} strokeDasharray="5 5" />
        </g>
      );
    });

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#fafafa',
        border: '1px solid #ddd',
        borderRadius: 2,
        touchAction: 'none',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => setSelectedId(null)}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '40%',
          left: 0,
          right: 0,
          borderBottom: '2px dashed #0288d1',
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      >
        <Typography
          variant="caption"
          sx={{ position: 'absolute', right: 16, bottom: 4, color: '#0288d1', fontWeight: 'bold' }}
        >
          Waterline (水面) - これより下は「要因・背景」
        </Typography>
      </Box>

      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
      >
        {renderLinks()}
      </svg>

      {nodes.map((node) => (
        <IcebergCard
          key={node.id}
          node={node}
          isSelected={selectedId === node.id}
          onPointerDown={handlePointerDown}
          onSelect={setSelectedId}
        />
      ))}
    </Box>
  );
};
