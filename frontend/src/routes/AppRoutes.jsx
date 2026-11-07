import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import LandingPage from '../features/LandingPage/components/LandingPage';
import DashboardPage from '../features/DashBoard/components/DashboardPage';
import ProjectManagement from '../features/Projects/components/ProjectManagement';
import TaskDetailPage from '../features/Projects/components/TaskDetailPage';
import ProfilePage from '../features/Profile/components/ProfilePage';


export default function AppRoutes() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(localStorage.getItem('access_token'))
  );

  const handleLoginSuccess = () => {
    // Cập nhật React ngay khi AuthModal lưu access_token thành công.
    setIsAuthenticated(true);
  };

  return (
    <Navigation isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated}>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated
              ? <DashboardPage />
              : <LandingPage onLoginSuccess={handleLoginSuccess} />
          }
        />
        <Route
          path="/project"
          element={isAuthenticated ? <ProjectManagement /> : <Navigate to="/" replace />}
        />
        <Route
          path="/task/:taskId"
          element={isAuthenticated ? <TaskDetailPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Navigation>
  );
}
