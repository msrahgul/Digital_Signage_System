// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';

import Layout from './components/Layout';

import LoginForm from './components/LoginForm';

import Dashboard from './pages/Dashboard';

import MediaLibrary from './pages/MediaLibrary';

import PlaylistBuilder from './pages/PlaylistBuilder';

import Scheduler from './pages/Scheduler';

import Players from './pages/Players';

import Ticker from './pages/Ticker';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/media"
          element={
            <ProtectedRoute>
              <MediaLibrary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/playlists"
          element={
            <ProtectedRoute>
              <PlaylistBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedules"
          element={
            <ProtectedRoute>
              <Scheduler />
            </ProtectedRoute>
          }
        />
        <Route
          path="/players"
          element={
            <ProtectedRoute>
              <Players />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ticker"
          element={
            <ProtectedRoute>
              <Ticker />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;