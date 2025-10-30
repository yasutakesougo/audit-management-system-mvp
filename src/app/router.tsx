import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import Home from '../pages/Home';
import UsersList from '../pages/UsersList';
import UserDetailPage from '../pages/UserDetailPage';

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>  
          <Route index element={<Home />} />
          <Route path="users" element={<UsersList />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          {/* other routes can remain here */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}