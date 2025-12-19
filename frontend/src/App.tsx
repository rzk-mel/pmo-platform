import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { ProtectedRoute, PublicRoute } from '@/components/auth'
import {
  DashboardPage,
  ProjectsPage,
  ProjectDetailPage,
  ProjectFormPage,
  ArtifactsListPage,
  ArtifactViewerPage,
  SignoffsPage,
  SignoffDetailPage,
  InquiriesPage,
  InquiryDetailPage,
  LoginPage,
} from '@/pages'

function App() {
  const { initialize } = useAuthStore()

  // Initialize auth on app load
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        
        {/* Projects */}
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<ProjectFormPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
        
        {/* Artifacts */}
        <Route path="/artifacts" element={<ArtifactsListPage />} />
        <Route path="/artifacts/:id" element={<ArtifactViewerPage />} />
        
        {/* Sign-offs */}
        <Route path="/signoffs" element={<SignoffsPage />} />
        <Route path="/signoffs/:id" element={<SignoffDetailPage />} />
        
        {/* Inquiries */}
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
        
        {/* GitHub Sync - requires developer+ role */}
        <Route
          path="/github"
          element={
            <ProtectedRoute requiredRole="developer">
              <GitHubSyncPage />
            </ProtectedRoute>
          }
        />
        
        {/* Settings - requires org_admin+ role */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute requiredRole="org_admin">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// Placeholder pages (to be implemented)
function GitHubSyncPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">GitHub Sync</h1>
      <p className="text-muted-foreground">Coming soon...</p>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Coming soon...</p>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-xl text-muted-foreground mt-4">Page not found</p>
        <a href="/" className="text-primary hover:underline mt-4 inline-block">
          Go back home
        </a>
      </div>
    </div>
  )
}

export default App
