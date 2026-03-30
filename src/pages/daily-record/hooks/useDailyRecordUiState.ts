import { useState, useCallback, useMemo } from 'react';
import type { PersonDaily } from '@/domain/daily/types';

export type DailyRecordUiState = {
  // 編集中のレコード
  records: PersonDaily[];
  formOpen: boolean;
  editingRecord: PersonDaily | undefined;
  contextOpen: boolean;
  
  // フィルタ
  searchQuery: string;
  statusFilter: string;
  dateFilter: string;
  
  // ハイライト
  activeHighlightUserId: string | null;
};

export type DailyRecordUiActions = {
  // レコード操作
  setRecords: React.Dispatch<React.SetStateAction<PersonDaily[]>>;
  updateRecord: (id: string, updated: Partial<PersonDaily>) => void;
  removeRecord: (id: string) => void;
  
  // 表示操作
  setFormOpen: (open: boolean) => void;
  setEditingRecord: (record: PersonDaily | undefined) => void;
  setContextOpen: (open: boolean) => void;
  
  // フィルタ
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  setDateFilter: (date: string) => void;
  
  // ハイライト
  setActiveHighlightUserId: (userId: string | null) => void;
};

export function useDailyRecordUiState(initialRecords: PersonDaily[]) {
  const [records, setRecords] = useState<PersonDaily[]>(initialRecords);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonDaily | undefined>();
  const [contextOpen, setContextOpen] = useState(false);
  
  // フィルタ
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  
  // ハイライト
  const [activeHighlightUserId, setActiveHighlightUserId] = useState<string | null>(null);

  const updateRecord = useCallback((id: string, updated: Partial<PersonDaily>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
  }, []);

  const removeRecord = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const state: DailyRecordUiState = useMemo(() => ({
    records,
    formOpen,
    editingRecord,
    contextOpen,
    searchQuery,
    statusFilter,
    dateFilter,
    activeHighlightUserId,
  }), [
    records, formOpen, editingRecord, contextOpen, 
    searchQuery, statusFilter, dateFilter, activeHighlightUserId
  ]);

  const actions: DailyRecordUiActions = {
    setRecords,
    updateRecord,
    removeRecord,
    setFormOpen,
    setEditingRecord,
    setContextOpen,
    setSearchQuery,
    setStatusFilter,
    setDateFilter,
    setActiveHighlightUserId,
  };

  return { state, actions };
}
