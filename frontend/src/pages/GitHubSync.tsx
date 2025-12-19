import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Github,
  ExternalLink,
  RefreshCw,
  GitPullRequest,
  GitCommit,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components/ui'
import { Input } from '@/components/ui/input'
import { useProjects } from '@/hooks/api'
import { syncFromGitHub, syncToGitHub } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatRelative, cn } from '@/lib/utils'
import type { Project } from '@/types'

export function GitHubSyncPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()
  
  const { data: projects, isLoading, error, refetch } = useProjects()
  
  // Filter projects that have GitHub integration
  const githubProjects = projects?.filter((p: Project) => p.github_repo_url) || []
  
  const filteredProjects = githubProjects.filter((p: Project) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.github_repo_url?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const syncFromMutation = useMutation({
    mutationFn: (projectId: string) => syncFromGitHub(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const syncToMutation = useMutation({
    mutationFn: (projectId: string) => syncToGitHub(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  if (isLoading) {
    return (
      <PageLayout title="GitHub Sync">
        <LoadingState message="Loading projects..." />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="GitHub Sync">
        <ErrorState message="Failed to load projects" onRetry={refetch} />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="GitHub Sync">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-medium text-muted-foreground">
            Manage GitHub repository integrations
          </h2>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {githubProjects.length === 0 ? (
        <EmptyState
          icon={<Github className="h-12 w-12 text-muted-foreground" />}
          title="No GitHub integrations"
          description="Connect your projects to GitHub repositories to enable sync features"
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12 text-muted-foreground" />}
          title="No matching projects"
          description="Try adjusting your search query"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project: Project) => (
            <Card key={project.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      <Github className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        <Link 
                          to={`/projects/${project.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {project.name}
                        </Link>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{project.code}</p>
                    </div>
                  </div>
                  <SyncStatusBadge status={project.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Repository URL */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <a
                    href={project.github_repo_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors truncate"
                  >
                    {project.github_repo_url?.replace('https://github.com/', '')}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>

                {/* Sync Stats */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <GitCommit className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Commits</p>
                    <p className="text-sm font-medium">-</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <GitPullRequest className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">PRs</p>
                    <p className="text-sm font-medium">-</p>
                  </div>
                </div>

                {/* Sync Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => syncFromMutation.mutate(project.id)}
                    disabled={syncFromMutation.isPending}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      syncFromMutation.isPending && "animate-spin"
                    )} />
                    Pull
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => syncToMutation.mutate(project.id)}
                    disabled={syncToMutation.isPending}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      syncToMutation.isPending && "animate-spin"
                    )} />
                    Push
                  </Button>
                </div>

                {/* Last Sync */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Last synced: {project.updated_at ? formatRelative(project.updated_at) : 'Never'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  )
}

function SyncStatusBadge({ status }: { status: string }) {
  const isActive = ['development', 'poc_phase', 'uat_phase'].includes(status)
  
  if (isActive) {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Active
      </Badge>
    )
  }
  
  if (status === 'completed' || status === 'cancelled') {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Inactive
      </Badge>
    )
  }
  
  return (
    <Badge variant="warning" className="flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Setup
    </Badge>
  )
}
