import React from 'react';
import { Routes, Route } from 'react-router-dom';
import RecordList from '../features/records/RecordList';
import ChecklistPage from '../features/compliance-checklist/ChecklistPage';
import AuditPanel from '../features/audit/AuditPanel';
import { UsersPanel } from '@/features/users';

const Router: React.FC = () => (
  <Routes>
    <Route path="/" element={<RecordList />} />
    <Route path="/checklist" element={<ChecklistPage />} />
    <Route path="/audit" element={<AuditPanel />} />
    <Route path="/users" element={<UsersPanel />} />
  </Routes>
);

export default Router;
