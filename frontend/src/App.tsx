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
  ArtifactFormPage,
  SignoffsPage,
  SignoffDetailPage,
  InquiriesPage,
  InquiryDetailPage,
  InquiryFormPage,
  TicketFormPage,
  LoginPage,
  GitHubSyncPage,
  SettingsPage,
  AIAssistantPage,
  KanbanBoardPage,
  GanttChartPage,
  ResourceAllocationPage,
  AnalyticsDashboardPage,
  BudgetTrackingPage,
  AutomatedReportsPage,
  ActivityStreamPage,
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
        <Route path="/artifacts/new" element={<ArtifactFormPage />} />
        <Route path="/artifacts/:id" element={<ArtifactViewerPage />} />
        
        {/* Tickets */}
        <Route path="/tickets/new" element={<TicketFormPage />} />
        <Route path="/tickets/:id/edit" element={<TicketFormPage />} />
        
        {/* Sign-offs */}
        <Route path="/signoffs" element={<SignoffsPage />} />
        <Route path="/signoffs/:id" element={<SignoffDetailPage />} />
        
        {/* Inquiries */}
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/inquiries/new" element={<InquiryFormPage />} />
        <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
        
        {/* Project Management */}
        <Route path="/kanban" element={<KanbanBoardPage />} />
        <Route path="/gantt" element={<GanttChartPage />} />
        <Route path="/resources" element={<ResourceAllocationPage />} />
        
        {/* Analytics & Reporting */}
        <Route path="/analytics" element={<AnalyticsDashboardPage />} />
        <Route path="/budget" element={<BudgetTrackingPage />} />
        <Route path="/reports" element={<AutomatedReportsPage />} />
        
        {/* Collaboration */}
        <Route path="/activity" element={<ActivityStreamPage />} />
        
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
        
        {/* AI Assistant */}
        <Route path="/ai" element={<AIAssistantPage />} />
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
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

