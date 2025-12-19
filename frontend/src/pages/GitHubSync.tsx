import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Github,
  ExternalLink,
  RefreshCw,
  GitPullRequest,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Link2,
  Unlink,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  FolderGit2,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  Button,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Label,
} from '@/components/ui'
import { useProjects, useTickets } from '@/hooks/api'
import {
  createGitHubIssue,
  linkGitHubIssue,
  unlinkGitHubIssue,
  syncTicketFromGitHub,
  syncFromGitHub,
  getGitHubIssues,
} from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatRelative, cn } from '@/lib/utils'
import type { Project, Ticket } from '@/types'

export function GitHubSyncPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [linkIssueNumber, setLinkIssueNumber] = useState('')
  const [linkingTicketId, setLinkingTicketId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects()
  const { data: tickets, isLoading: ticketsLoading, error: ticketsError, refetch: refetchTickets } = useTickets()
  
  // Filter projects that have GitHub integration
  const githubProjects = projects?.filter((p: Project) => p.github_repo_url) || []
  
  // Get the first project with GitHub as default
  const activeProjectId = selectedProjectId || githubProjects[0]?.id
  const activeProject = githubProjects.find((p: Project) => p.id === activeProjectId)
  
  // Get tickets for the active project
  const projectTickets = tickets?.filter((t: Ticket) => t.project_id === activeProjectId) || []
  
  // Separate linked and unlinked tickets
  const linkedTickets = projectTickets.filter((t: Ticket) => t.github_issue_number)
  const unlinkedTickets = projectTickets.filter((t: Ticket) => !t.github_issue_number)
  
  // Filter by search
  const filteredLinkedTickets = linkedTickets.filter((t: Ticket) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredUnlinkedTickets = unlinkedTickets.filter((t: Ticket) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Fetch GitHub issues for the project
  const { data: githubIssuesData, isLoading: issuesLoading, refetch: refetchIssues } = useQuery({
    queryKey: ['github-issues', activeProjectId],
    queryFn: () => activeProjectId ? getGitHubIssues(activeProjectId, 'all') : null,
    enabled: !!activeProjectId,
  })
  const githubIssues = githubIssuesData?.issues || []

  // Mutations
  const createIssueMutation = useMutation({
    mutationFn: (ticketId: string) => createGitHubIssue(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      refetchIssues()
    },
  })

  const linkIssueMutation = useMutation({
    mutationFn: ({ ticketId, issueNumber }: { ticketId: string; issueNumber: number }) =>
      linkGitHubIssue(ticketId, issueNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setLinkingTicketId(null)
      setLinkIssueNumber('')
    },
  })

  const unlinkIssueMutation = useMutation({
    mutationFn: (ticketId: string) => unlinkGitHubIssue(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const syncTicketMutation = useMutation({
    mutationFn: (ticketId: string) => syncTicketFromGitHub(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const bulkSyncMutation = useMutation({
    mutationFn: (projectId: string) => syncFromGitHub(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      refetchIssues()
    },
  })

  const handleLinkIssue = (ticketId: string) => {
    const issueNum = parseInt(linkIssueNumber)
    if (issueNum > 0) {
      linkIssueMutation.mutate({ ticketId, issueNumber: issueNum })
    }
  }

  const isLoading = projectsLoading || ticketsLoading

  if (isLoading) {
    return (
      <PageLayout title="GitHub Sync">
        <LoadingState message="Loading data..." />
      </PageLayout>
    )
  }

  if (projectsError || ticketsError) {
    return (
      <PageLayout title="GitHub Sync">
        <ErrorState message="Failed to load data" onRetry={() => { refetchTickets() }} />
      </PageLayout>
    )
  }

  if (githubProjects.length === 0) {
    return (
      <PageLayout title="GitHub Sync">
        <EmptyState
          icon={<Github className="h-12 w-12 text-muted-foreground" />}
          title="No GitHub integrations"
          description="Connect your projects to GitHub repositories to enable sync features. Edit a project and add a GitHub repository URL."
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="GitHub Sync">
      {/* Project Selector & Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="project-select" className="text-sm text-muted-foreground mb-1 block">Project</Label>
            <select
              id="project-select"
              className="px-3 py-2 border rounded-lg bg-background text-sm min-w-[200px]"
              value={activeProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {githubProjects.map((p: Project) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          {activeProject && (
            <a
              href={activeProject.github_repo_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-5"
            >
              <Github className="h-4 w-4" />
              {activeProject.github_repo_url?.replace('https://github.com/', '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeProjectId && bulkSyncMutation.mutate(activeProjectId)}
            disabled={bulkSyncMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", bulkSyncMutation.isPending && "animate-spin")} />
            Sync All
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="linked" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="linked" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Linked ({linkedTickets.length})
          </TabsTrigger>
          <TabsTrigger value="unlinked" className="flex items-center gap-2">
            <Unlink className="h-4 w-4" />
            Unlinked ({unlinkedTickets.length})
          </TabsTrigger>
          <TabsTrigger value="issues" className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4" />
            Issues ({githubIssues.length})
          </TabsTrigger>
        </TabsList>

        {/* Linked Tickets Tab */}
        <TabsContent value="linked" className="space-y-4">
          {filteredLinkedTickets.length === 0 ? (
            <EmptyState
              icon={<Link2 className="h-12 w-12 text-muted-foreground" />}
              title="No linked tickets"
              description="Link tickets to GitHub issues or create new issues from existing tickets."
            />
          ) : (
            <div className="grid gap-3">
              {filteredLinkedTickets.map((ticket: Ticket) => (
                <Card key={ticket.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Badge variant="outline" className="shrink-0">
                          <GitPullRequest className="h-3 w-3 mr-1" />
                          #{ticket.github_issue_number}
                        </Badge>
                        <div className="min-w-0">
                          <Link
                            to={`/tickets/${ticket.id}`}
                            className="font-medium hover:text-primary transition-colors truncate block"
                          >
                            {ticket.title}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <StatusBadge status={ticket.status} />
                            {ticket.github_synced_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Synced {formatRelative(ticket.github_synced_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => syncTicketMutation.mutate(ticket.id)}
                          disabled={syncTicketMutation.isPending}
                          title="Sync from GitHub"
                        >
                          <ArrowDownLeft className={cn("h-4 w-4", syncTicketMutation.isPending && "animate-spin")} />
                        </Button>
                        <a
                          href={`${activeProject?.github_repo_url}/issues/${ticket.github_issue_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" title="View on GitHub">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unlinkIssueMutation.mutate(ticket.id)}
                          disabled={unlinkIssueMutation.isPending}
                          title="Unlink"
                          className="text-destructive hover:text-destructive"
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Unlinked Tickets Tab */}
        <TabsContent value="unlinked" className="space-y-4">
          {filteredUnlinkedTickets.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-12 w-12 text-muted-foreground" />}
              title="All tickets are linked"
              description="All tickets in this project are already linked to GitHub issues."
            />
          ) : (
            <div className="grid gap-3">
              {filteredUnlinkedTickets.map((ticket: Ticket) => (
                <Card key={ticket.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className="font-medium hover:text-primary transition-colors truncate block"
                        >
                          {ticket.title}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <StatusBadge status={ticket.status} />
                          <span>Priority: {ticket.priority}</span>
                        </div>
                      </div>
                      
                      {linkingTicketId === ticket.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Issue #"
                            value={linkIssueNumber}
                            onChange={(e) => setLinkIssueNumber(e.target.value)}
                            className="w-24"
                            type="number"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleLinkIssue(ticket.id)}
                            disabled={linkIssueMutation.isPending || !linkIssueNumber}
                          >
                            Link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setLinkingTicketId(null); setLinkIssueNumber(''); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLinkingTicketId(ticket.id)}
                          >
                            <Link2 className="h-4 w-4 mr-1" />
                            Link
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => createIssueMutation.mutate(ticket.id)}
                            disabled={createIssueMutation.isPending}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Create Issue
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* GitHub Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Issues from GitHub repository
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchIssues()}
              disabled={issuesLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", issuesLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          
          {issuesLoading ? (
            <LoadingState message="Loading GitHub issues..." />
          ) : githubIssues.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="h-12 w-12 text-muted-foreground" />}
              title="No issues found"
              description="No open issues in this GitHub repository."
            />
          ) : (
            <div className="grid gap-3">
              {githubIssues.map((issue: { number: number; title: string; state: string; html_url: string; created_at: string }) => {
                const isLinked = linkedTickets.some((t: Ticket) => t.github_issue_number === issue.number)
                return (
                  <Card key={issue.number} className={cn(isLinked && "border-primary/50 bg-primary/5")}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant={issue.state === 'open' ? 'success' : 'secondary'}>
                            {issue.state}
                          </Badge>
                          <div className="min-w-0">
                            <a
                              href={issue.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:text-primary transition-colors flex items-center gap-1"
                            >
                              #{issue.number} {issue.title}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <p className="text-xs text-muted-foreground">
                              Created {formatRelative(issue.created_at)}
                            </p>
                          </div>
                        </div>
                        {isLinked ? (
                          <Badge variant="outline" className="text-primary">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Linked
                          </Badge>
                        ) : (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={issue.html_url} target="_blank" rel="noopener noreferrer">
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'default'> = {
    done: 'success',
    in_progress: 'warning',
    review: 'warning',
    blocked: 'destructive',
    cancelled: 'secondary',
    open: 'default',
  }
  
  return (
    <Badge variant={variants[status] || 'default'} className="text-xs">
      {status.replace('_', ' ')}
    </Badge>
  )
}
