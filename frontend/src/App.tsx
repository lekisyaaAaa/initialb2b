import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import components
import HomePage from './pages/HomePage';
import ContactPage from './pages/ContactPage';
import PublicDashboard from './pages/PublicDashboard';
import EnhancedDashboard from './pages/EnhancedDashboard';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import LogsPage from './pages/LogsPage';
import ThresholdsPage from './pages/ThresholdsPage';
import HomeAssistant from './pages/HomeAssistant';

// Import context providers
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { DarkModeProvider } from './contexts/DarkModeContext';

// Import components
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <DarkModeProvider>
      <AuthProvider>
        <DataProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/dashboard" element={<PublicDashboard />} />
                <Route path="/enhanced-dashboard" element={<EnhancedDashboard />} />
                <Route path="/login" element={<LoginPage />} />
                {/* Public admin login route used by landing page */}
                <Route path="/admin/login" element={<LoginPage />} />
                <Route path="/admin" element={<ProtectedRoute><Navigate to="/admin/dashboard" replace /></ProtectedRoute>} />
                {/* Explicit dashboard path kept for compatibility */}
                <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                {/* dev-only debug route removed */}
                <Route path="/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
                <Route path="/thresholds" element={<ProtectedRoute><ThresholdsPage /></ProtectedRoute>} />
                <Route path="/home-assistant" element={<ProtectedRoute><HomeAssistant /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </Router>
        </DataProvider>
      </AuthProvider>
    </DarkModeProvider>
  );
}

export default App;
