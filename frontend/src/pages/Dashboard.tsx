import { Link } from 'react-router-dom'
import {
  FolderKanban,
  FileText,
  CheckSquare,
  Clock,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Badge, LoadingState, ErrorState } from '@/components/ui'
import { useProjects, useMySignoffs } from '@/hooks/api'
import { useAuthStore } from '@/stores/auth'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  formatRelative,
  ROLE_LABELS,
} from '@/lib/utils'

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  href,
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: string
  href?: string
}) {
  const content = (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {trend && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {trend}
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link to={href}>{content}</Link>
  }
  return content
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects()
  const { data: signoffs, isLoading: signoffsLoading } = useMySignoffs()

  if (projectsLoading) {
    return (
      <PageLayout title="Dashboard">
        <LoadingState message="Loading dashboard..." />
      </PageLayout>
    )
  }

  if (projectsError) {
    return (
      <PageLayout title="Dashboard">
        <ErrorState message="Failed to load dashboard data" />
      </PageLayout>
    )
  }

  // Calculate stats
  const activeProjects = projects?.filter(p => 
    !['completed', 'cancelled'].includes(p.status)
  ).length || 0
  
  const pendingSignoffs = signoffs?.length || 0
  
  const recentProjects = projects?.slice(0, 5) || []

  return (
    <PageLayout title="Dashboard">
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold">
          Welcome back, {user?.full_name?.split(' ')[0]}
        </h2>
        <p className="text-muted-foreground">
          {ROLE_LABELS[user?.role || 'viewer']} • {user?.email}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Active Projects"
          value={activeProjects}
          icon={FolderKanban}
          href="/projects"
        />
        <StatCard
          title="Pending Sign-offs"
          value={pendingSignoffs}
          icon={CheckSquare}
          href="/signoffs"
        />
        <StatCard
          title="Total Artifacts"
          value={projects?.reduce((acc: number, p) => acc + ((p.phase_metadata as { artifactCount?: number })?.artifactCount || 0), 0) || 0}
          icon={FileText}
          href="/artifacts"
        />
        <StatCard
          title="Due This Week"
          value={signoffs?.filter(s => {
            if (!s.due_date) return false
            const due = new Date(s.due_date)
            const now = new Date()
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            return due <= weekFromNow
          }).length || 0}
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Projects</CardTitle>
            <Link
              to="/projects"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No projects yet
              </p>
            ) : (
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {project.code} • Updated {formatRelative(project.updated_at)}
                      </p>
                    </div>
                    <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Sign-offs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Sign-offs</CardTitle>
            <Link
              to="/signoffs"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {signoffsLoading ? (
              <LoadingState message="Loading sign-offs..." />
            ) : !signoffs || signoffs.length === 0 ? (
              <div className="py-8 text-center">
                <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No pending sign-offs
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {signoffs.slice(0, 5).map((signoff) => {
                  const artifact = signoff.artifact as { title: string; project: { name: string } } | undefined
                  return (
                    <Link
                      key={signoff.id}
                      to={`/signoffs/${signoff.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {artifact?.title || 'Untitled Artifact'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {artifact?.project?.name || 'Unknown Project'}
                        </p>
                      </div>
                      {signoff.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due {formatRelative(signoff.due_date)}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
