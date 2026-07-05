import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SemesterProvider } from './contexts/SemesterContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './contexts/ConfirmContext';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './index.css';

// Hooks
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useHaptics } from './hooks/useHaptics';

// Layout
import AppLayout from './components/layout/AppLayout';
import PageTransition from './components/ui/PageTransition';

// Pages - Static Imports for instant, lag-free navigation without loading screens
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import TimeTable from './pages/TimeTable';
import Courses from './pages/Courses';
import Practicals from './pages/Practicals';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFound from './pages/NotFound';

// ── Route Guards ─────────────────────────────────────────────────────────────

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

// ── Main App Routes ───────────────────────────────────────────────────────────

const AppRoutes: React.FC = () => {
  return (
    <Routes>

      {/* ── Public Routes ──────────────────────────────────── */}
      <Route
        path="/"
        element={
          <PageTransition>
            <Landing />
          </PageTransition>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <PageTransition>
              <Login />
            </PageTransition>
          </PublicRoute>
        }
      />

      {/* ── Legal Pages ────────────────────────────────────── */}
      <Route
        path="/privacy"
        element={
          <PageTransition>
            <PrivacyPolicy />
          </PageTransition>
        }
      />
      <Route
        path="/terms"
        element={
          <PageTransition>
            <TermsOfService />
          </PageTransition>
        }
      />

      {/* ── 404 (outside AppLayout) ────────────────────────── */}
      <Route
        path="/404"
        element={
          <PageTransition>
            <NotFound />
          </PageTransition>
        }
      />

      {/* ── Protected Routes inside App Shell ──────────────── */}
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/timetable"
          element={
            <ProtectedRoute>
              <TimeTable />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <Courses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practicals"
          element={
            <ProtectedRoute>
              <Practicals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

      </Route>

      {/* ── Catch-all → 404 ────────────────────────────────── */}
      <Route
        path="*"
        element={
          <PageTransition>
            <NotFound />
          </PageTransition>
        }
      />

    </Routes>
  );
};

// ── Keyboard Shortcuts (needs BrowserRouter context) ─────────────────────────

const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useKeyboardShortcuts();
  return <>{children}</>;
};

// ── App Content ───────────────────────────────────────────────────────────────

const AppContent: React.FC = () => {
  useAutoUpdate();
  useHaptics();

  return (
    <div className="min-h-screen bg-background text-on-background font-sans transition-colors duration-300 selection:bg-primary-container selection:text-primary">
      <AppRoutes />
      {import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(window.location.hostname) && <VercelAnalytics />}
    </div>
  );
};

// ── Root App ──────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'missing-client-id';

const App: React.FC = () => {
  if (GOOGLE_CLIENT_ID === 'missing-client-id') {
    console.warn('Missing VITE_GOOGLE_CLIENT_ID. Google Login will not work. Please configure the frontend environment before starting the app.');
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <SemesterProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    <ErrorBoundary>
                      <KeyboardShortcutsProvider>
                        <AppContent />
                      </KeyboardShortcutsProvider>
                    </ErrorBoundary>
                  </ConfirmProvider>
                </ToastProvider>
              </SemesterProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
};

export default App;

