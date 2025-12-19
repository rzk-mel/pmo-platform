import { useState, useMemo } from 'react'
import {
  Users,
  Briefcase,
  Clock,
  TrendingUp,
  AlertTriangle,
  FolderKanban,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  Label,
} from '@/components/ui'
import { useProjects, useTickets } from '@/hooks/api'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Project, Ticket, Profile } from '@/types'

const HOURS_PER_WEEK = 40

interface TeamMemberWorkload {
  member: Profile
  totalEstimated: number
  totalLogged: number
  ticketCount: number
  ticketsByProject: Record<string, { projectName: string; count: number; hours: number }>
  overloaded: boolean
  utilizationPercent: number
}

export function ResourceAllocationPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: allTickets, isLoading: ticketsLoading, error: ticketsError } = useTickets()
  
  // Fetch team members
  const { data: teamMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return data as Profile[]
    },
  })

  // Calculate workload for each team member
  const workloadData = useMemo(() => {
    if (!teamMembers || !allTickets || !projects) return []

    const projectsMap = projects.reduce((acc: Record<string, Project>, p: Project) => {
      acc[p.id] = p
      return acc
    }, {})

    // Filter tickets
    const tickets = selectedProjectId 
      ? allTickets.filter((t: Ticket) => t.project_id === selectedProjectId)
      : allTickets

    // Group by assignee
    const workloadByMember: Record<string, TeamMemberWorkload> = {}

    // Initialize all members
    teamMembers.forEach((member: Profile) => {
      workloadByMember[member.id] = {
        member,
        totalEstimated: 0,
        totalLogged: 0,
        ticketCount: 0,
        ticketsByProject: {},
        overloaded: false,
        utilizationPercent: 0,
      }
    })

    // Calculate workload from tickets
    tickets
      .filter((t: Ticket) => t.assignee_id && t.status !== 'done' && t.status !== 'cancelled')
      .forEach((ticket: Ticket) => {
        const assigneeId = ticket.assignee_id!
        if (!workloadByMember[assigneeId]) return

        const estimated = ticket.estimated_hours || 0
        const logged = ticket.logged_hours || 0
        const project = projectsMap[ticket.project_id]
        const projectName = project?.name || 'Unknown'

        workloadByMember[assigneeId].totalEstimated += estimated
        workloadByMember[assigneeId].totalLogged += logged
        workloadByMember[assigneeId].ticketCount += 1

        if (!workloadByMember[assigneeId].ticketsByProject[ticket.project_id]) {
          workloadByMember[assigneeId].ticketsByProject[ticket.project_id] = {
            projectName,
            count: 0,
            hours: 0,
          }
        }
        workloadByMember[assigneeId].ticketsByProject[ticket.project_id].count += 1
        workloadByMember[assigneeId].ticketsByProject[ticket.project_id].hours += estimated
      })

    // Calculate utilization and overload status
    Object.values(workloadByMember).forEach((w) => {
      w.utilizationPercent = Math.round((w.totalEstimated / HOURS_PER_WEEK) * 100)
      w.overloaded = w.totalEstimated > HOURS_PER_WEEK
    })

    // Sort by utilization (highest first)
    return Object.values(workloadByMember)
      .filter(w => w.ticketCount > 0 || !selectedProjectId) // Show all members or only those with tickets
      .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
  }, [teamMembers, allTickets, projects, selectedProjectId])

  // Stats
  const stats = useMemo(() => {
    const activeTasks = allTickets?.filter((t: Ticket) => 
      t.status !== 'done' && t.status !== 'cancelled' &&
      (selectedProjectId ? t.project_id === selectedProjectId : true)
    ).length || 0

    const overloadedMembers = workloadData.filter(w => w.overloaded).length
    const totalEstimated = workloadData.reduce((sum, w) => sum + w.totalEstimated, 0)
    const avgUtilization = workloadData.length > 0
      ? Math.round(workloadData.reduce((sum, w) => sum + w.utilizationPercent, 0) / workloadData.length)
      : 0

    return { activeTasks, overloadedMembers, totalEstimated, avgUtilization }
  }, [workloadData, allTickets, selectedProjectId])

  const isLoading = projectsLoading || ticketsLoading || membersLoading

  if (isLoading) {
    return (
      <PageLayout title="Resource Allocation">
        <LoadingState message="Loading resources..." />
      </PageLayout>
    )
  }

  if (ticketsError) {
    return (
      <PageLayout title="Resource Allocation">
        <ErrorState message="Failed to load data" />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Resource Allocation">
      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Label>Project</Label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm min-w-[200px]"
          >
            <option value="">All Projects</option>
            {projects?.map((p: Project) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workloadData.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeTasks}</p>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg dark:bg-yellow-900/30">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEstimated}h</p>
                <p className="text-sm text-muted-foreground">Total Estimated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                stats.overloadedMembers > 0 
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                  : "bg-purple-100 text-purple-600 dark:bg-purple-900/30"
              )}>
                {stats.overloadedMembers > 0 ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <TrendingUp className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgUtilization}%</p>
                <p className="text-sm text-muted-foreground">Avg Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload */}
      {workloadData.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
          title="No team data"
          description="Team members with assigned tickets will appear here"
        />
      ) : (
        <div className="grid gap-4">
          {workloadData.map((workload) => (
            <Card key={workload.member.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Member Info */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={workload.member.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(workload.member.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{workload.member.full_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {workload.member.role.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">
                        {workload.totalEstimated}h / {HOURS_PER_WEEK}h capacity
                      </span>
                      <span className={cn(
                        "text-sm font-medium",
                        workload.overloaded ? "text-red-500" : "text-green-500"
                      )}>
                        {workload.utilizationPercent}%
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          workload.utilizationPercent > 100 ? "bg-red-500" :
                          workload.utilizationPercent > 80 ? "bg-yellow-500" : "bg-green-500"
                        )}
                        style={{ width: `${Math.min(workload.utilizationPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{workload.ticketCount} tasks</span>
                    </div>
                    {workload.overloaded && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Overloaded
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Projects Breakdown */}
                {Object.keys(workload.ticketsByProject).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Project Breakdown:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(workload.ticketsByProject).map(([projectId, data]) => (
                        <Badge key={projectId} variant="outline" className="flex items-center gap-1">
                          <FolderKanban className="h-3 w-3" />
                          {data.projectName}: {data.count} tasks ({data.hours}h)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
