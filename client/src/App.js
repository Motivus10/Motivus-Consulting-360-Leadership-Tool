import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminProject from './pages/AdminProject';
import AdminResults from './pages/AdminResults';
import Survey from './pages/Survey';
import Nominate from './pages/Nominate';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login"              element={<AdminLogin />} />
          <Route path="/admin"                    element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/projects/:id"       element={<PrivateRoute><AdminProject /></PrivateRoute>} />
          <Route path="/admin/projects/:id/results" element={<PrivateRoute><AdminResults /></PrivateRoute>} />
          <Route path="/survey"                   element={<Survey />} />
          <Route path="/nominate"                 element={<Nominate />} />
          <Route path="*"                         element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
