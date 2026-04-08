import { IcebergCanvas } from '@/features/ibd/analysis/iceberg/IcebergCanvas';
import { IcebergCard } from '@/features/ibd/analysis/iceberg/IcebergCard';
import { IcebergDetailSidebar } from '@/features/ibd/analysis/iceberg/IcebergDetailSidebar';
import { TESTIDS } from '@/testids';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { icebergSnapshotSchema, type IcebergNode, type HypothesisLink, type IcebergEvent } from '@/features/ibd/analysis/iceberg/icebergTypes';

const mockNodes: IcebergNode[] = [
  { id: 'node-1', type: 'behavior', label: '行動A', position: { x: 100, y: 100 }, status: 'hypothesis' },
  { id: 'node-2', type: 'assessment', label: '要因B', position: { x: 400, y: 100 }, status: 'hypothesis' },
];

const mockLinks: HypothesisLink[] = [
  { id: 'link-1', sourceNodeId: 'node-2', targetNodeId: 'node-1', confidence: 'high', status: 'hypothesis' },
];

const theme = createTheme();

describe('Iceberg Analysis UI Components', () => {
  describe('IcebergCanvas', () => {
    it('renders legend and waterline', () => {
      render(
        <ThemeProvider theme={theme}>
          <IcebergCanvas 
            nodes={mockNodes} 
            links={mockLinks} 
            onMoveNode={() => {}} 
          />
        </ThemeProvider>
      );

      expect(screen.getByTestId(TESTIDS['iceberg-legend'])).toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS['iceberg-waterline'])).toBeVisible();
      expect(screen.getByText('WATERLINE (水面)')).toBeInTheDocument();
    });

    it('renders nodes and links', () => {
      render(
        <ThemeProvider theme={theme}>
          <IcebergCanvas 
            nodes={mockNodes} 
            links={mockLinks} 
            onMoveNode={() => {}} 
          />
        </ThemeProvider>
      );

      expect(screen.getByText('要因B')).toBeInTheDocument();
      // SVG links are harder to target by testid directly if not unique, 
      // but we use consistent data-testid now
      expect(screen.getByTestId(TESTIDS['iceberg-links'])).toBeInTheDocument();
      expect(screen.getByTestId(`${TESTIDS['iceberg-link-item']}link-1`)).toBeInTheDocument();
    });

    it('shows confidence labels on links in Meeting Mode', () => {
      render(
        <ThemeProvider theme={theme}>
          <IcebergCanvas 
            nodes={mockNodes} 
            links={mockLinks} 
            onMoveNode={() => {}} 
            isMeetingMode={true}
          />
        </ThemeProvider>
      );

      // high confidence link should show "実証済み" in Meeting Mode
      expect(screen.getByText(/実証済み/)).toBeInTheDocument();
    });
  });

  describe('IcebergCard', () => {
    it('shows selected state with CSS class', () => {
      render(
        <ThemeProvider theme={theme}>
          <IcebergCard 
            node={mockNodes[0]} 
            isSelected={true} 
            onPointerDown={() => {}} 
            onSelect={() => {}} 
          />
        </ThemeProvider>
      );

      const card = screen.getByTestId(`iceberg-card-item${mockNodes[0].id}`);
      expect(card).toHaveClass('iceberg-card-selected');
    });

    it('shows multi-modal labels (icons + text)', () => {
      render(
        <ThemeProvider theme={theme}>
          <IcebergCard 
            node={mockNodes[0]} 
            isSelected={false} 
            onPointerDown={() => {}} 
            onSelect={() => {}} 
          />
        </ThemeProvider>
      );

      // check for the redundant label "行動 (結果)" we added for clarity
      expect(screen.getByText('行動 (結果)')).toBeInTheDocument();
    });

    it('applies pulsing animation in Meeting Mode when selected', () => {
      render(
        <ThemeProvider theme={theme}>
          <IcebergCard 
            node={mockNodes[0]} 
            isSelected={true} 
            isMeetingMode={true}
            onPointerDown={() => {}} 
            onSelect={() => {}} 
          />
        </ThemeProvider>
      );

      const card = screen.getByTestId(`iceberg-card-item${mockNodes[0].id}`);
      const styles = window.getComputedStyle(card);
      // 'animation' property in JSDOM might be tricky, but we check if it includes the pulse name
      expect(styles.animation).toBeTruthy();
    });

    it('disables pointer events for dragging in Meeting Mode', () => {
      const onPointerDown = vi.fn();
      render(
        <ThemeProvider theme={theme}>
          <IcebergCard 
            node={mockNodes[0]} 
            isSelected={false} 
            isMeetingMode={true}
            onPointerDown={onPointerDown} 
            onSelect={() => {}} 
          />
        </ThemeProvider>
      );

      const dragHandle = screen.getByText('行動 (結果)').parentElement!;
      fireEvent.pointerDown(dragHandle);
      
      expect(onPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('IcebergDetailSidebar', () => {
    it('renders node details and allows deletion', () => {
      const onDelete = vi.fn();
      const onClose = vi.fn();
      
      render(
        <ThemeProvider theme={theme}>
          <IcebergDetailSidebar 
            node={mockNodes[0]} 
            onClose={onClose}
            onUpdateNode={() => {}}
            onDeleteNode={onDelete}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('項目の詳細設定')).toBeInTheDocument();
      expect(screen.getByDisplayValue('行動A')).toBeInTheDocument();

      // Mock confirmation and click delete
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByText('分析から削除'));
      
      expect(onDelete).toHaveBeenCalledWith(mockNodes[0].id);
      expect(onClose).toHaveBeenCalled();
    });

    it('renders link details in meeting mode as read-only', () => {
      render(
        <ThemeProvider theme={theme}>
          <IcebergDetailSidebar 
            link={mockLinks[0]} 
            nodes={mockNodes}
            onClose={() => {}}
            isReadOnly={true}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('因果関係の詳細')).toBeInTheDocument();
      expect(screen.getByText('FROM (要因):')).toBeInTheDocument();
      
      // Select (Confidence) should be disabled in ReadOnly mode
      const select = screen.getByTestId(TESTIDS['iceberg-confidence-select']);
      expect(select).toHaveClass('Mui-disabled');
    });

    it('filters logs correctly for a target node', () => {
      const mockLogs: IcebergEvent[] = [
        { id: '1', type: 'session_created', timestamp: new Date().toISOString(), message: 'Session started' },
        { id: '2', type: 'node_added', timestamp: new Date().toISOString(), message: 'Node A added', targetId: 'node-1' },
        { id: '3', type: 'node_added', timestamp: new Date().toISOString(), message: 'Node B added', targetId: 'node-2' },
      ];

      render(
        <ThemeProvider theme={theme}>
          <IcebergDetailSidebar 
            node={mockNodes[0]} // node-1
            logs={mockLogs}
            onClose={() => {}} 
          />
        </ThemeProvider>
      );

      // Switch to History tab
      fireEvent.click(screen.getByText('履歴'));

      expect(screen.getByText('Session started')).toBeInTheDocument();
      expect(screen.getByText('Node A added')).toBeInTheDocument();
      expect(screen.queryByText('Node B added')).toBeNull();
    });
  });

  describe('Iceberg Schema Validation', () => {
    it('validates a snapshot with confidence and notes', () => {
      const validSnapshot = {
        schemaVersion: 1,
        sessionId: 'session-1',
        userId: 'user-1',
        title: 'Test Session',
        updatedAt: new Date().toISOString(),
        nodes: mockNodes,
        links: [
          { 
            id: 'link-1', 
            sourceNodeId: 'node-2', 
            targetNodeId: 'node-1', 
            confidence: 'high',
            note: 'This is a test note'
          }
        ]
      };

      expect(() => icebergSnapshotSchema.parse(validSnapshot)).not.toThrow();
    });

    it('rejects invalid confidence values', () => {
      const invalidSnapshot = {
        schemaVersion: 1,
        sessionId: 'session-1',
        userId: 'user-1',
        title: 'Test Session',
        updatedAt: new Date().toISOString(),
        nodes: mockNodes,
        links: [
          { 
            id: 'link-1', 
            sourceNodeId: 'node-2', 
            targetNodeId: 'node-1', 
            confidence: 'very-high' // Invalid enum value
          }
        ]
      };

      expect(() => icebergSnapshotSchema.parse(invalidSnapshot)).toThrow();
    });

    it('handles legacy snapshots without logs by providing a default empty array', () => {
      const legacySnapshot = {
        schemaVersion: 1,
        sessionId: 'session-1',
        userId: 'user-1',
        title: 'Legacy Session',
        updatedAt: new Date().toISOString(),
        nodes: [],
        links: []
        // logs is missing
      };

      const result = icebergSnapshotSchema.parse(legacySnapshot);
      expect(result.logs).toEqual([]);
    });
  });
});
