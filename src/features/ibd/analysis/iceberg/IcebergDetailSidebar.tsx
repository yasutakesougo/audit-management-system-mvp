import type { IcebergNode, HypothesisLink, IcebergNodeStatus } from '@/features/ibd/analysis/iceberg/icebergTypes';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/Person';
import PsychologyIcon from '@mui/icons-material/Psychology';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { alpha } from '@mui/material/styles';
import { TESTIDS, tid } from '@/testids';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import type { IcebergEvent } from '@/features/ibd/analysis/iceberg/icebergTypes';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import SearchIcon from '@mui/icons-material/Search';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import React, { useState, useEffect } from 'react';

type Props = {
  node?: IcebergNode | null;
  link?: HypothesisLink | null;
  nodes?: IcebergNode[];
  onClose: () => void;
  onUpdateNode?: (node: IcebergNode) => void;
  onDeleteNode?: (id: string) => void;
  onUpdateLink?: (link: HypothesisLink) => void;
  onDeleteLink?: (id: string) => void;
  isReadOnly?: boolean;
  logs?: IcebergEvent[];
};

export const IcebergDetailSidebar: React.FC<Props> = ({ 
  node, link, nodes = [], onClose, 
  onUpdateNode, onDeleteNode, onUpdateLink, onDeleteLink,
  isReadOnly = false, logs = [] 
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [showAllLogs, setShowAllLogs] = useState(false);
  
  // -- Evidence State --
  const [matchingRecords, setMatchingRecords] = useState<AbcRecord[]>([]);
  const [linkedRecords, setLinkedRecords] = useState<AbcRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local buffering
  const [localNote, setLocalNote] = useState(link?.note || '');
  const [localDetails, setLocalDetails] = useState(node?.details || '');
  const [localRationale, setLocalRationale] = useState(node?.statusRationale || link?.statusRationale || '');

  const isLinkMode = !!link;

  // Reset local state when target changes
  React.useEffect(() => {
    setLocalNote(link?.note || '');
    setLocalRationale(link?.statusRationale || '');
    if (link) {
      const target = nodes?.find(n => n.id === link.targetNodeId);
      setSearchQuery(target?.label || '');
    }
  }, [link?.id, link?.note, link?.statusRationale, nodes]);

  React.useEffect(() => {
    setLocalDetails(node?.details || '');
    setLocalRationale(node?.statusRationale || '');
    setSearchQuery(node?.label || ''); // Set default search query to node label
  }, [node?.id, node?.details, node?.label, node?.statusRationale]);

  // -- Record Fetching --
  const userId = nodes?.[0]?.sourceId || ''; // Getting userId from nodes (heuristic)
  // Note: Better would be to pass userId as prop, but let's try to infer if not available

  useEffect(() => {
    const fetchLinked = async () => {
      const ids = (isLinkMode ? link?.evidenceRecordIds : node?.evidenceRecordIds) || [];
      if (ids.length === 0) {
        setLinkedRecords([]);
        return;
      }
      const all = await localAbcRecordRepository.getAll();
      setLinkedRecords(all.filter(r => ids.includes(r.id)));
    };
    fetchLinked();
  }, [node?.evidenceRecordIds, link?.evidenceRecordIds, isLinkMode]);

  useEffect(() => {
    if (tabValue === 1) {
      const fetchRecords = async () => {
        setIsSearching(true);
        const query = searchQuery.trim().toLowerCase();
        const all = await localAbcRecordRepository.getAll();
        const filtered = all.filter(r => {
          if (userId && r.userId !== userId) return false;
          const text = (r.behavior + r.antecedent + r.consequence + (r.notes || '')).toLowerCase();
          return query === '' || text.includes(query);
        });
        setMatchingRecords(filtered);
        setIsSearching(false);
      };
      fetchRecords();
    }
  }, [tabValue, searchQuery, userId]);

  const toggleEvidence = (recordId: string) => {
    if (isLinkMode && link && onUpdateLink) {
      const current = link.evidenceRecordIds || [];
      const next = current.includes(recordId) 
        ? current.filter(id => id !== recordId) 
        : [...current, recordId];
      onUpdateLink({ ...link, evidenceRecordIds: next });
    } else if (!isLinkMode && node && onUpdateNode) {
      const current = node.evidenceRecordIds || [];
      const next = current.includes(recordId) 
        ? current.filter(id => id !== recordId) 
        : [...current, recordId];
      onUpdateNode({ ...node, evidenceRecordIds: next });
    }
  };

  const evidenceCount = (isLinkMode ? link?.evidenceRecordIds : node?.evidenceRecordIds)?.length || 0;

  // -- Node Handlers --
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (node && onUpdateNode) onUpdateNode({ ...node, label: e.target.value });
  };
  const handleStatusChange = (_: React.MouseEvent<HTMLElement>, newStatus: string | null) => {
    if (node && onUpdateNode && newStatus) {
      if (newStatus === 'validated') {
        const hasEvidence = (node.evidenceRecordIds?.length || 0) > 0;
        const hasRationale = !!node.statusRationale?.trim() || !!localRationale?.trim();
        if (!hasEvidence || !hasRationale) {
          // Stay on current or go to hypothesis, but show warning
          return;
        }
      }
      onUpdateNode({ ...node, status: newStatus as IcebergNodeStatus });
    }
  };
  const handleDetailsBlur = () => {
    if (node && onUpdateNode && localDetails !== node.details) {
      onUpdateNode({ ...node, details: localDetails });
    }
  };

  const handleRationaleBlur = () => {
    if (isLinkMode && link && onUpdateLink && localRationale !== link.statusRationale) {
      onUpdateLink({ ...link, statusRationale: localRationale });
    } else if (!isLinkMode && node && onUpdateNode && localRationale !== node.statusRationale) {
      onUpdateNode({ ...node, statusRationale: localRationale });
    }
  };

  // -- Link Handlers --
  const handleConfidenceChange = (e: SelectChangeEvent<HypothesisLink['confidence']>) => {
    if (link && onUpdateLink) onUpdateLink({ ...link, confidence: e.target.value as HypothesisLink['confidence'] });
  };
  const handleLinkNoteBlur = () => {
    if (link && onUpdateLink && localNote !== (link.note || '')) {
      onUpdateLink({ ...link, note: localNote });
    }
  };
  const handleLinkStatusChange = (_: React.MouseEvent<HTMLElement>, newStatus: string | null) => {
    if (link && onUpdateLink && newStatus) {
      if (newStatus === 'validated') {
        const hasEvidence = (link.evidenceRecordIds?.length || 0) > 0;
        const hasRationale = !!link.statusRationale?.trim() || !!localRationale?.trim();
        if (!hasEvidence || !hasRationale) {
          return;
        }
      }
      onUpdateLink({ ...link, status: newStatus as HypothesisLink['status'] });
    }
  };

  const getSourceNode = () => nodes.find(n => n.id === link?.sourceNodeId);
  const getTargetNode = () => nodes.find(n => n.id === link?.targetNodeId);

  const color = (() => {
    if (isLinkMode) return '#455a64';
    if (!node) return '#666';
    switch (node.type) {
      case 'behavior': return '#c62828';
      case 'assessment': return '#1565c0';
      case 'environment': return '#2e7d32';
      default: return '#666';
    }
  })();

  return (
    <Paper
      elevation={4}
      {...tid(TESTIDS['iceberg-sidebar'])}
      sx={{
        width: 340,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', bgcolor: alpha(color, 0.04) }}>
        {isLinkMode ? <PsychologyIcon sx={{ color, mr: 1.5, fontSize: 20 }} /> : <InfoOutlinedIcon sx={{ color, mr: 1.5, fontSize: 20 }} />}
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" fontWeight={700}>
              {isLinkMode ? '因果関係の詳細' : '項目の詳細設定'}
            </Typography>
            {(node?.status === 'validated' || link?.status === 'validated') && (
              <Chip 
                label="検証済み" 
                size="small" 
                color="primary" 
                variant="filled" 
                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} 
              />
            )}
          </Stack>
        </Box>
        <IconButton size="small" onClick={onClose} {...tid(TESTIDS['iceberg-sidebar-close'])} aria-label="閉じる">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      
      <Tabs 
        value={tabValue} 
        onChange={(_, v) => setTabValue(v)} 
        variant="fullWidth"
        sx={{ minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="性質" sx={{ fontSize: '0.75rem', minHeight: 40 }} />
        <Tab icon={<FactCheckIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`根拠 (${evidenceCount})`} sx={{ fontSize: '0.75rem', minHeight: 40 }} />
        <Tab icon={<HistoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="履歴" sx={{ fontSize: '0.75rem', minHeight: 40 }} />
      </Tabs>

      {/* Content */}
      <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
        {tabValue === 0 ? (
          <Stack spacing={3}>
            {isLinkMode && link ? (
              /* LINK EDIT MODE */
              <>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                    仮説の方向
                  </Typography>
                  <Stack spacing={1}>
                    <Paper variant="outlined" sx={{ p: 1, bgcolor: alpha('#eee', 0.5) }}>
                      <Typography variant="caption" color="text.disabled">FROM (要因):</Typography>
                      <Typography variant="body2" fontWeight="bold">{getSourceNode()?.label || '不明なノード'}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1, bgcolor: alpha('#eee', 0.5) }}>
                      <Typography variant="caption" color="text.disabled">TO (行動):</Typography>
                      <Typography variant="body2" fontWeight="bold">{getTargetNode()?.label || '不明なノード'}</Typography>
                    </Paper>
                  </Stack>
                </Box>

                <Stack spacing={2.5}>
                  <FormControl component="fieldset" fullWidth variant="outlined" size="small">
                    <InputLabel>仮説の確信度 / 合意段階</InputLabel>
                    <Select
                      value={link.confidence}
                      onChange={handleConfidenceChange}
                      label="仮説の確信度 / 合意段階"
                      disabled={isReadOnly}
                      {...tid(TESTIDS['iceberg-confidence-select'])}
                    >
                      <MenuItem value="low">仮説段階 (薄い点線)</MenuItem>
                      <MenuItem value="medium">有力な候補 (太い点線)</MenuItem>
                      <MenuItem value="high">合意・確信 (太い実線)</MenuItem>
                    </Select>
                  </FormControl>

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1.5 }}>
                      因果関係の状態（判断）
                    </Typography>
                    <ToggleButtonGroup
                      value={link.status || 'hypothesis'}
                      exclusive
                      onChange={handleLinkStatusChange}
                      aria-label="link status"
                      size="small"
                      fullWidth
                      disabled={isReadOnly}
                      sx={{
                        '& .MuiToggleButton-root': {
                          py: 1,
                          flex: 1,
                          transition: 'all 0.2s',
                          '&.Mui-selected': {
                            bgcolor: link.status === 'validated' ? alpha('#1976d2', 0.1) : alpha('#ed6c02', 0.1),
                            color: link.status === 'validated' ? '#0d47a1' : '#e65100',
                            fontWeight: 'bold',
                          }
                        }
                      }}
                    >
                      <ToggleButton value="hypothesis">
                        <Stack alignItems="center" spacing={0.5}>
                          <PsychologyIcon sx={{ fontSize: 18 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>仮説</Typography>
                        </Stack>
                      </ToggleButton>
                      <ToggleButton value="validated">
                        <Stack alignItems="center" spacing={0.5}>
                          <CheckCircleIcon sx={{ fontSize: 18 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>検証済み</Typography>
                        </Stack>
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', fontStyle: 'italic', lineHeight: 1.4 }}>
                      {link.status === 'validated' ? '※ このつながりは実際の支援記録等で裏付けられました' : '※ 現時点での推察される因果関係です'}
                    </Typography>
                  </Box>

                  {link.status === 'validated' && (
                    <Box sx={{ mt: 1, bgcolor: alpha('#4caf50', 0.05), p: 2, borderRadius: 2, border: '1px solid', borderColor: alpha('#4caf50', 0.2) }}>
                      <Typography variant="caption" color="success.main" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                        検証済みの理由・サマリ
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                        placeholder="なぜ検証済みと判断したか、背景や合意事項を記入してください..."
                        value={localRationale}
                        onChange={(e) => setLocalRationale(e.target.value)}
                        onBlur={handleRationaleBlur}
                        sx={{ bgcolor: 'background.paper' }}
                      />
                    </Box>
                  )}

                  <TextField
                    label="因果関係の根拠・メモ"
                    value={localNote}
                    onChange={(e) => setLocalNote(e.target.value)}
                    onBlur={handleLinkNoteBlur}
                    fullWidth
                    multiline
                    rows={4}
                    variant="outlined"
                    placeholder="なぜこの要因が行動に繋がると考えたか、根拠を記入してください..."
                    disabled={isReadOnly}
                    {...tid(TESTIDS['iceberg-link-note'])}
                  />
                </Stack>
              </>
            ) : node ? (
              /* NODE EDIT MODE */
              <>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                    項目の属性
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.2)}` }}>
                      <Typography variant="caption" fontWeight="bold" color={color}>
                        {node.type === 'behavior' ? '行動 (結果)' : node.type === 'assessment' ? '内の要因' : '環境要因'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.disabled">
                      ID: {node.id.slice(0, 8)}
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ mt: 3, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1.5 }}>
                    思考の状態（判断）
                  </Typography>
                  <ToggleButtonGroup
                    value={node.status || 'hypothesis'}
                    exclusive
                    onChange={handleStatusChange}
                    aria-label="thinking status"
                    size="small"
                    fullWidth
                    disabled={isReadOnly}
                    sx={{
                      '& .MuiToggleButton-root': {
                        py: 1,
                        flex: 1,
                        transition: 'all 0.2s',
                        '&.Mui-selected': {
                          bgcolor: node.status === 'fact' ? alpha('#2e7d32', 0.1) : node.status === 'validated' ? alpha('#1976d2', 0.1) : alpha('#ed6c02', 0.1),
                          color: node.status === 'fact' ? '#1b5e20' : node.status === 'validated' ? '#0d47a1' : '#e65100',
                          fontWeight: 'bold',
                        }
                      }
                    }}
                  >
                    <ToggleButton value="hypothesis">
                      <Stack alignItems="center" spacing={0.5}>
                        <PsychologyIcon sx={{ fontSize: 18 }} />
                        <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>仮説</Typography>
                      </Stack>
                    </ToggleButton>
                    <ToggleButton value="validated">
                      <Stack alignItems="center" spacing={0.5}>
                        <CheckCircleIcon sx={{ fontSize: 18 }} />
                        <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>検証済み</Typography>
                      </Stack>
                    </ToggleButton>
                    <ToggleButton value="fact">
                      <Stack alignItems="center" spacing={0.5}>
                        <FactCheckIcon sx={{ fontSize: 18 }} />
                        <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>事実</Typography>
                      </Stack>
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', fontStyle: 'italic', lineHeight: 1.4 }}>
                    {node.status === 'fact' ? '※ アセスメント等の根拠がある事実です' : 
                     node.status === 'validated' ? '※ 支援の実践を通して裏付けられました' : 
                     '※ 可能性として考えられる推察（アイデア）です'}
                  </Typography>
                </Box>

                {node.status === 'validated' && (
                  <Box sx={{ mt: 1, bgcolor: alpha('#4caf50', 0.05), p: 2, borderRadius: 2, border: '1px solid', borderColor: alpha('#4caf50', 0.2) }}>
                    <Typography variant="caption" color="success.main" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                      検証済みの理由・サマリ
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      placeholder="なぜ検証済みと判断したか、背景や合意事項を記入してください..."
                      value={localRationale}
                      onChange={(e) => setLocalRationale(e.target.value)}
                      onBlur={handleRationaleBlur}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                  </Box>
                )}

                {/* Validation Requirements Alert */}
                {(node.status === 'hypothesis') && (
                  <Box sx={{ mt: 1 }}>
                    <Alert 
                      severity={(evidenceCount > 0 && localRationale.trim()) ? "success" : "info"}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', py: 0.5, '& .MuiAlert-icon': { fontSize: 16 } }}
                    >
                      「検証済み」への昇格条件:
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip label="根拠1件以上" size="small" color={evidenceCount > 0 ? "success" : "default"} variant={evidenceCount > 0 ? "filled" : "outlined"} sx={{ height: 18, fontSize: '0.6rem' }} />
                        <Chip label="理由の記入" size="small" color={localRationale.trim() ? "success" : "default"} variant={localRationale.trim() ? "filled" : "outlined"} sx={{ height: 18, fontSize: '0.6rem' }} />
                      </Stack>
                    </Alert>
                  </Box>
                )}

                <Stack spacing={2.5}>
                  <TextField
                    label="見出し / タイトル"
                    value={node.label}
                    onChange={handleLabelChange}
                    fullWidth
                    size="small"
                    variant="outlined"
                    disabled={isReadOnly}
                  />
                  <TextField
                    label="詳細説明・観察内容"
                    value={localDetails}
                    onChange={(e) => setLocalDetails(e.target.value)}
                    onBlur={handleDetailsBlur}
                    fullWidth
                    multiline
                    rows={4}
                    variant="outlined"
                    placeholder="支援会議での議論や具体的なエピソードを記入してください..."
                    disabled={isReadOnly}
                  />
                </Stack>
              </>
            ) : null}

            <Divider />

            {/* Supporter Context (Shared) */}
            <Stack spacing={1.5}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                支援者間共有
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <PersonIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary">
                  登録者: システム管理者
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <HistoryIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary">
                  最終更新: {node?.updatedAt || link?.updatedAt || '---'}
                </Typography>
              </Stack>
            </Stack>

            <Box sx={{ mt: 4 }}>
              <Button
                color="error"
                variant="text"
                size="small"
                startIcon={<DeleteOutlineIcon />}
                disabled={isReadOnly}
                {...tid(TESTIDS['iceberg-sidebar-delete'])}
                onClick={() => {
                  if (window.confirm(isLinkMode ? 'この因果関係を削除しますか？' : 'この項目を分析から削除しますか？')) {
                    if (isLinkMode && link && onDeleteLink) onDeleteLink(link.id);
                    else if (!isLinkMode && node && onDeleteNode) onDeleteNode(node.id);
                    onClose();
                  }
                }}
              >
                分析から削除
              </Button>
            </Box>
          </Stack>
        ) : tabValue === 1 ? (
          /* EVIDENCE MODE */
          <Stack spacing={2.5}>
            {/* Linked Records Section */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1.5 }}>
                紐付け済みのエビデンス ({evidenceCount})
              </Typography>
              <Stack spacing={1}>
                {linkedRecords.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50', borderStyle: 'dashed' }}>
                    <Typography variant="caption" color="text.disabled">
                      紐付けられた記録はありません。下の検索から追加してください。
                    </Typography>
                  </Paper>
                ) : (
                  linkedRecords.map(record => (
                    <Paper 
                      key={`linked-${record.id}`} 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5, 
                        borderColor: 'primary.main',
                        bgcolor: alpha('#1976d2', 0.04),
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <BookmarkIcon fontSize="small" color="primary" sx={{ mt: 0.25 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" fontWeight="bold" display="block">
                            {new Date(record.occurredAt).toLocaleDateString()}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {record.behavior}
                          </Typography>
                          <Button 
                            size="small" 
                            color="inherit" 
                            sx={{ mt: 0.5, fontSize: '0.65rem', p: 0, minWidth: 0, textTransform: 'none' }}
                            onClick={() => toggleEvidence(record.id)}
                          >
                            紐付けを解除
                          </Button>
                        </Box>
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            </Box>

            <Divider />

            {/* Search Section */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                関連記録を検索・追加
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="記録を検索 (行動、メモ...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 1, fontSize: 18 }} />,
                }}
              />
            </Box>

            <Stack spacing={1.5}>
              {matchingRecords.filter(r => !linkedRecords.some(lr => lr.id === r.id)).length === 0 ? (
                <Typography variant="caption" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
                  {isSearching ? '検索中...' : '追加可能な記録が見つかりません'}
                </Typography>
              ) : (
                matchingRecords.filter(r => !linkedRecords.some(lr => lr.id === r.id)).map(record => {
                  return (
                    <Paper 
                      key={`search-${record.id}`} 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5, 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: alpha('#1976d2', 0.04), borderColor: 'primary.light' }
                      }}
                      onClick={() => toggleEvidence(record.id)}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <BookmarkBorderIcon fontSize="small" sx={{ mt: 0.25, color: 'text.disabled' }} />
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {new Date(record.occurredAt).toLocaleDateString()}
                            </Typography>
                            <Chip 
                              label={record.intensity === 'high' ? '強' : record.intensity === 'medium' ? '中' : '弱'} 
                              size="small" 
                              sx={{ height: 16, fontSize: '0.6rem' }} 
                            />
                          </Stack>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.4, color: 'text.secondary' }}>
                            {record.behavior}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })
              )}
            </Stack>

            {evidenceCount >= 3 && (node?.status === 'hypothesis' || link?.status === 'hypothesis') && (
              <Alert 
                severity="success" 
                icon={<AutoFixHighIcon fontSize="inherit" />}
                sx={{ borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.75rem' } }}
              >
                多くの記録が紐付いています。状態を<strong>「検証済み」</strong>に昇格させることを検討してください。
              </Alert>
            )}
          </Stack>
        ) : (
          /* HISTORY MODE */
          <Stack spacing={2}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              会議・検討ログ (Session History)
            </Typography>
            {logs.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                履歴はありません
              </Typography>
            ) : (
              <>
                {(showAllLogs ? [...logs].reverse() : [...logs].reverse().slice(0, 5))
                  .filter((log) => {
                    const tid = (node?.id || link?.id);
                    return !log.targetId || log.targetId === tid;
                  })
                  .map((log) => {
                    const logId = String(log.id || Math.random());
                    const ration = (log.payload && typeof log.payload === 'object' && 'rationale' in log.payload) ? String(log.payload.rationale) : '';
                    const recId = (log.payload && typeof log.payload === 'object' && 'recordId' in log.payload) ? String(log.payload.recordId) : '';
                    
                    return (
                      <Box 
                        key={logId} 
                        sx={{ 
                          pl: 1.5, 
                          borderLeft: '2px solid', 
                          borderColor: 'divider',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: -5,
                            top: 4,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'divider'
                          }
                        }}
                      >
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                          {new Date(log.timestamp).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                          {String(log.message)}
                        </Typography>
                        {ration && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: alpha('#4caf50', 0.08), borderRadius: 1, borderLeft: '3px solid', borderColor: '#4caf50' }}>
                            <Typography variant="caption" color="success.main" fontWeight="bold" display="block">
                              検証理由:
                            </Typography>
                            <Typography variant="caption" color="text.primary">
                              {ration}
                            </Typography>
                          </Box>
                        )}
                        {recId && (
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              対象記録ID: {recId}
                            </Typography>
                          </Box>
                        )}
                        {log.userName && (
                          <Typography variant="caption" color="primary" fontWeight="bold" sx={{ mt: 0.5, display: 'block' }}>
                            @{String(log.userName)}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                {logs.length > 5 && (
                  <Button 
                    size="small" 
                    variant="text" 
                    onClick={() => setShowAllLogs(!showAllLogs)}
                    sx={{ alignSelf: 'center', fontSize: '0.7rem' }}
                  >
                    {showAllLogs ? '履歴を折りたたむ' : `他 ${logs.length - 5} 件を表示`}
                  </Button>
                )}
              </>
            )}
          </Stack>
        )}
      </Box>

      {/* Footer / Actions */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', textAlign: 'center', display: 'block' }}>
          ※ 変更は即座にキャンバスへ反映されます
        </Typography>
      </Box>
    </Paper>
  );
};
