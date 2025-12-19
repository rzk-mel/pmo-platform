import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  GitBranch,
  Play,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Progress,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components/ui'
// Avatar removed - unused
import { useProject, useProjectArtifacts, useProjectTickets, useGitHubSync } from '@/hooks/api'
import { useAuthStore } from '@/stores/auth'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  ARTIFACT_STATUS_LABELS,
  ARTIFACT_STATUS_COLORS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  PRIORITY_COLORS,
  formatDate,
  formatRelative,
  canEditProject,
} from '@/lib/utils'
import { transitionProject, syncFromGitHub } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectStatus } from '@/types'

// Next allowed transitions
const NEXT_STATUS: Partial<Record<ProjectStatus, ProjectStatus>> = {
  draft: 'scoping',
  scoping: 'sow_draft',
  sow_draft: 'sow_review',
  sow_review: 'poc_phase',
  poc_phase: 'development',
  development: 'uat_phase',
  uat_phase: 'sign_off',
  sign_off: 'completed',
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const { data: project, isLoading, error } = useProject(id!)
  const { data: artifacts } = useProjectArtifacts(id!)
  const { data: tickets } = useProjectTickets(id!)
  const { data: githubSync } = useGitHubSync(id!)

  const canEdit = canEditProject(user?.role || 'viewer')

  const transitionMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: string }) =>
      transitionProject(projectId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: (projectId: string) => syncFromGitHub(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-sync', id] })
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'tickets'] })
    },
  })

  if (isLoading) {
    return (
      <PageLayout>
        <LoadingState message="Loading project..." />
      </PageLayout>
    )
  }

  if (error || !project) {
    return (
      <PageLayout>
        <ErrorState message="Project not found" />
      </PageLayout>
    )
  }

  const nextStatus = NEXT_STATUS[project.status]
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

  const doneTickets = tickets?.filter(t => t.status === 'done').length || 0
  const totalTickets = tickets?.length || 0
  const ticketProgress = totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0

  return (
    <PageLayout
      title={project.name}
      actions={
        <div className="flex gap-2">
          {project.github_repo_url && (
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate(id!)}
              isLoading={syncMutation.isPending}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Sync GitHub
            </Button>
          )}
          {canEdit && nextStatus && (
            <Button
              onClick={() => transitionMutation.mutate({ projectId: id!, status: nextStatus })}
              isLoading={transitionMutation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              Move to {PROJECT_STATUS_LABELS[nextStatus]}
            </Button>
          )}
        </div>
      }
    >
      {/* Back link */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-muted-foreground">{project.code}</span>
                <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-2">{project.description}</p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Project Progress</span>
              <span className="font-medium">{statusProgress[project.status]}%</span>
            </div>
            <Progress value={statusProgress[project.status]} className="h-3" />
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">
                {project.start_date ? formatDate(project.start_date) : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Target End</p>
              <p className="font-medium">
                {project.target_end_date ? formatDate(project.target_end_date) : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Project Manager</p>
              <p className="font-medium">
                {project.project_manager?.full_name || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tech Lead</p>
              <p className="font-medium">
                {project.tech_lead?.full_name || 'Unassigned'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs/Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Artifacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Artifacts</CardTitle>
            {canEdit && (
              <Button size="sm" variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                New Artifact
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!artifacts || artifacts.length === 0 ? (
              <EmptyState
                title="No artifacts"
                description="Create your first artifact for this project"
              />
            ) : (
              <div className="space-y-3">
                {artifacts.slice(0, 5).map((artifact) => (
                  <Link
                    key={artifact.id}
                    to={`/artifacts/${artifact.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{artifact.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {artifact.type} • v{artifact.version}
                      </p>
                    </div>
                    <Badge className={ARTIFACT_STATUS_COLORS[artifact.status]}>
                      {ARTIFACT_STATUS_LABELS[artifact.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tickets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Tickets ({doneTickets}/{totalTickets})
            </CardTitle>
            {canEdit && (
              <Button size="sm" variant="outline">
                New Ticket
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Ticket progress */}
            <div className="mb-4">
              <Progress value={ticketProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {ticketProgress}% complete
              </p>
            </div>

            {!tickets || tickets.length === 0 ? (
              <EmptyState
                title="No tickets"
                description="Create tickets to track work"
              />
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={PRIORITY_COLORS[ticket.priority]} variant="outline">
                          {ticket.priority}
                        </Badge>
                        <p className="font-medium truncate">{ticket.title}</p>
                      </div>
                      {ticket.assignee && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Assigned to {ticket.assignee.full_name}
                        </p>
                      )}
                    </div>
                    <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* GitHub Sync */}
        {project.github_repo_url && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                GitHub Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium">{project.github_repo_url}</p>
                  <p className="text-sm text-muted-foreground">
                    Last synced: {githubSync?.[0]?.last_synced_at 
                      ? formatRelative(githubSync[0].last_synced_at) 
                      : 'Never'}
                  </p>
                </div>
                <Badge variant="success">Connected</Badge>
              </div>

              {githubSync && githubSync.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {githubSync.slice(0, 5).map((sync) => (
                    <div key={sync.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {sync.github_entity_type} #{sync.github_entity_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sync.direction} • {formatRelative(sync.last_synced_at)}
                        </p>
                      </div>
                      <Badge
                        variant={sync.sync_status === 'synced' ? 'success' : 'warning'}
                      >
                        {sync.sync_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}
