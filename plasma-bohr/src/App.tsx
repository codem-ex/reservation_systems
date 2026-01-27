import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';

import SearchRooms from './pages/SearchRooms';

// Placeholder components
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/AdminDashboard';

import Login from './pages/Login';
import { getCurrentUser } from './services/storage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }>
          <Route index element={<Home />} />
          <Route path="search" element={<SearchRooms />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="admin" element={<AdminDashboard />} />
          {/* Redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
