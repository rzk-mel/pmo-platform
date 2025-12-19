import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  Button,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  Progress,
} from '@/components/ui'
import { useProjects } from '@/hooks/api'
import { useAuthStore } from '@/stores/auth'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  formatDate,
  canEditProject,
} from '@/lib/utils'
import type { Project, ProjectStatus } from '@/types'

const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Projects' },
  { value: 'draft', label: 'Draft' },
  { value: 'scoping', label: 'Scoping' },
  { value: 'sow_draft', label: 'SOW Draft' },
  { value: 'sow_review', label: 'SOW Review' },
  { value: 'poc_phase', label: 'POC' },
  { value: 'development', label: 'Development' },
  { value: 'uat_phase', label: 'UAT' },
  { value: 'sign_off', label: 'Sign Off' },
  { value: 'completed', label: 'Completed' },
]

function ProjectCard({ project }: { project: Project }) {
  // Calculate fake progress for demo
  const statusProgress: Record<ProjectStatus, number> = {
    draft: 5,
    scoping: 15,
    sow_draft: 25,
    sow_review: 35,
    poc_phase: 50,
    development: 70,
    uat_phase: 85,
    sign_off: 95,
    completed: 100,
    cancelled: 0,
  }

  const progress = statusProgress[project.status]

  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">{project.code}</p>
              <h3 className="font-semibold text-lg truncate">{project.name}</h3>
            </div>
            <Badge className={PROJECT_STATUS_COLORS[project.status]}>
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {project.description}
            </p>
          )}

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {project.start_date ? formatDate(project.start_date) : 'Not started'}
              </span>
              {project.target_end_date && (
                <span className="text-muted-foreground">
                  → {formatDate(project.target_end_date)}
                </span>
              )}
            </div>

            {project.project_manager && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {project.project_manager.full_name?.charAt(0)}
                </div>
                <span className="text-sm text-muted-foreground">
                  {project.project_manager.full_name}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: projects, isLoading, error, refetch } = useProjects()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')

  const canCreate = canEditProject(user?.role || 'viewer')

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <PageLayout
      title="Projects"
      actions={
        canCreate && (
          <Button onClick={() => navigate('/projects/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )
      }
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
            className="px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading && <LoadingState message="Loading projects..." />}
      
      {error && (
        <ErrorState
          message="Failed to load projects"
          onRetry={() => refetch()}
        />
      )}
      
      {!isLoading && !error && filteredProjects?.length === 0 && (
        <EmptyState
          title="No projects found"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first project to get started'
          }
          action={
            canCreate && !searchQuery && statusFilter === 'all'
              ? {
                  label: 'Create Project',
                  onClick: () => navigate('/projects/new'),
                }
              : undefined
          }
        />
      )}

      {!isLoading && !error && filteredProjects && filteredProjects.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </PageLayout>
  )
}
