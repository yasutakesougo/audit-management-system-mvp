import { IcebergCard } from '@/features/ibd/analysis/iceberg/IcebergCard';
import type { HypothesisLink, IcebergNode, IcebergNodeType, NodePosition } from '@/features/ibd/analysis/iceberg/icebergTypes';
import AddIcon from '@mui/icons-material/Add';
import AddLinkIcon from '@mui/icons-material/AddLink';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useRef, useState } from 'react';

type Props = {
  nodes: IcebergNode[];
  links: HypothesisLink[];
  onMoveNode: (id: string, position: NodePosition) => void;
  onAddNode?: (label: string, type: IcebergNodeType, details?: string) => void;
  onEditNode?: (id: string, patch: Partial<Pick<IcebergNode, 'label' | 'details' | 'type'>>) => void;
  onRemoveNode?: (id: string) => void;
  onLinkNodes?: (sourceId: string, targetId: string, confidence?: HypothesisLink['confidence']) => void;
  onRemoveLink?: (linkId: string) => void;
};

const CARD_WIDTH = 220;
const CARD_HEIGHT = 120;

const NODE_TYPE_OPTIONS: { value: IcebergNodeType; label: string }[] = [
  { value: 'behavior', label: '行動 (結果)' },
  { value: 'assessment', label: '特性 (要因)' },
  { value: 'environment', label: '環境因子' },
];

type NodeFormState = {
  label: string;
  type: IcebergNodeType;
  details: string;
};

const INITIAL_FORM: NodeFormState = { label: '', type: 'behavior', details: '' };

export const IcebergCanvas: React.FC<Props> = ({
  nodes, links, onMoveNode, onAddNode, onEditNode, onRemoveNode, onLinkNodes, onRemoveLink,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [form, setForm] = useState<NodeFormState>(INITIAL_FORM);

  // Link mode state
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);

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

  // ── Node select handler (also handles link mode) ──

  const handleNodeSelect = (nodeId: string) => {
    if (linkSourceId) {
      // Link mode: second node clicked → create link
      if (linkSourceId !== nodeId) {
        onLinkNodes?.(linkSourceId, nodeId);
      }
      setLinkSourceId(null);
      setSelectedId(null);
      return;
    }
    setSelectedId(nodeId);
  };

  // ── Dialog handlers ──

  const handleOpenAdd = () => {
    setEditingNodeId(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  };

  const handleOpenEdit = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setEditingNodeId(nodeId);
    setForm({ label: node.label, type: node.type, details: node.details ?? '' });
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!form.label.trim()) return;
    if (editingNodeId) {
      onEditNode?.(editingNodeId, {
        label: form.label.trim(),
        type: form.type,
        details: form.details.trim() || undefined,
      });
    } else {
      onAddNode?.(form.label.trim(), form.type, form.details.trim() || undefined);
    }
    setDialogOpen(false);
    setForm(INITIAL_FORM);
    setEditingNodeId(null);
  };

  const handleRemove = (nodeId: string) => {
    onRemoveNode?.(nodeId);
    setSelectedId(null);
  };

  // ── Link mode handlers ──

  const handleStartLinking = () => {
    if (selectedId) {
      setLinkSourceId(selectedId);
    }
  };

  const handleCancelLinking = () => {
    setLinkSourceId(null);
  };

  // ── Link click handler ──

  const handleLinkClick = (linkId: string) => {
    if (onRemoveLink && window.confirm('このリンクを削除しますか？')) {
      onRemoveLink(linkId);
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

      const isHighlighted = linkSourceId === link.sourceNodeId || linkSourceId === link.targetNodeId;

      return (
        <g key={link.id} data-testid={`iceberg-link-${link.id}`}>
          {/* Invisible wider line for easier clicking */}
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="transparent" strokeWidth={12}
            style={{ pointerEvents: 'stroke', cursor: onRemoveLink ? 'pointer' : 'default' }}
            onClick={() => handleLinkClick(link.id)}
          />
          {/* Visible dashed line */}
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isHighlighted ? '#e91e63' : '#90a4ae'}
            strokeWidth={2}
            strokeDasharray="5 5"
            style={{ pointerEvents: 'none' }}
          />
        </g>
      );
    });

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
        {onAddNode && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            data-testid="iceberg-add-node-btn"
          >
            ノード追加
          </Button>
        )}
        {onLinkNodes && selectedId && !linkSourceId && (
          <Tooltip title="選択中のノードからリンクを開始します">
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<AddLinkIcon />}
              onClick={handleStartLinking}
              data-testid="iceberg-start-link-btn"
            >
              リンク開始
            </Button>
          </Tooltip>
        )}
        {linkSourceId && (
          <Chip
            label={`リンク中: ${nodes.find((n) => n.id === linkSourceId)?.label ?? '...'} → 接続先を選択`}
            color="secondary"
            onDelete={handleCancelLinking}
            data-testid="iceberg-linking-chip"
            sx={{ fontWeight: 'bold' }}
          />
        )}
      </Box>

      <Box
        ref={containerRef}
        data-testid="iceberg-canvas"
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          bgcolor: linkSourceId ? '#fce4ec' : '#fafafa',
          border: linkSourceId ? '2px solid #e91e63' : '1px solid #ddd',
          borderRadius: 2,
          touchAction: 'none',
          transition: 'background-color 0.2s, border-color 0.2s',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => {
          if (!linkSourceId) setSelectedId(null);
        }}
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
          data-testid="iceberg-links"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
        >
          {renderLinks()}
        </svg>

        {nodes.map((node) => (
          <IcebergCard
            key={node.id}
            node={node}
            isSelected={selectedId === node.id}
            onPointerDown={handlePointerDown}
            onSelect={handleNodeSelect}
            onEdit={onEditNode ? handleOpenEdit : undefined}
            onRemove={onRemoveNode ? handleRemove : undefined}
          />
        ))}
      </Box>

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        data-testid="iceberg-node-dialog"
      >
        <DialogTitle>{editingNodeId ? 'ノード編集' : 'ノード追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            label="ラベル"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            size="small"
            autoFocus
            required
            data-testid="iceberg-node-label-input"
          />
          <TextField
            label="タイプ"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as IcebergNodeType }))}
            size="small"
            select
            data-testid="iceberg-node-type-select"
          >
            {NODE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="詳細メモ"
            value={form.details}
            onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
            size="small"
            multiline
            rows={2}
            data-testid="iceberg-node-details-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleDialogSave}
            disabled={!form.label.trim()}
            data-testid="iceberg-node-save-btn"
          >
            {editingNodeId ? '更新' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
