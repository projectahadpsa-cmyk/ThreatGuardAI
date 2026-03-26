import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth }  from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { loadMLModels } from './services/inference'
import ProtectedRoute    from './components/ProtectedRoute'
import LoadingScreen     from './components/LoadingScreen'
import { AnimatePresence, motion } from 'motion/react'

import Landing   from './pages/Landing'
import Login     from './pages/Login'
import Register  from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Dashboard from './pages/Dashboard'
import Detection from './pages/Detection'
import Results   from './pages/Results'
import History   from './pages/History'
import Profile   from './pages/Profile'
import AdminUsers from './pages/AdminUsers'
import AdminReports from './pages/AdminReports'
import AdminSettings from './pages/AdminSettings'
import ApiKeyManagement from './pages/ApiKeyManagement'
import AppLayout from './components/AppLayout'

import Navbar from './components/Navbar'

function AppContent() {
  const { loading } = useAuth()
  const [modelsLoaded, setModelsLoaded] = useState(false)

  useEffect(() => {
    // Load models in background without blocking UI
    loadMLModels()
      .then(() => {
        console.log('Models loaded');
        setModelsLoaded(true);
      })
      .catch(err => {
        console.error('Error loading models, using fallback:', err);
        setModelsLoaded(true); // Still set to true so UI shows
      });
    
    // Skip default user seeding - users will register/login manually
    // Don't seed users as it can interfere with authentication
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence mode="wait">
        {(loading || !modelsLoaded) ? (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999]"
          >
            <LoadingScreen />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col flex-1"
          >
            <Routes>
              {/* Public */}
              <Route path="/"         element={<Landing />} />
              <Route path="/login"    element={<><Navbar /><Login /></>} />
              <Route path="/register" element={<><Navbar /><Register /></>} />
              <Route path="/forgot-password" element={<><Navbar /><ForgotPassword /></>} />
              <Route path="/terms"    element={<><Navbar /><TermsOfService /></>} />
              <Route path="/privacy"  element={<><Navbar /><PrivacyPolicy /></>} />

              {/* Protected — wrapped in shared sidebar layout */}
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index              element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard"  element={<Dashboard />} />
                <Route path="detection"  element={<Detection />} />
                <Route path="results"    element={<Results />} />
                <Route path="history"    element={<History />} />
                <Route path="api-keys"   element={<ApiKeyManagement />} />
                <Route path="profile"    element={<Profile />} />
                
                {/* Admin Routes */}
                <Route path="admin/users"    element={<AdminUsers />} />
                <Route path="admin/reports"  element={<AdminReports />} />
                <Route path="admin/settings" element={<AdminSettings />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
