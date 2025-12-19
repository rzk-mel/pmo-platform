import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { LoadingState } from '@/components/ui/states'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  requiredRole?: UserRole
  children?: React.ReactNode
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasMinimumRole } = useAuthStore()

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Checking authentication..." />
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check role if required
  if (requiredRole && !hasMinimumRole(requiredRole)) {
    return <Navigate to="/" replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    )
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
