import { useState, useMemo } from 'react'
import {
  Users,
  Briefcase,
  Clock,
  TrendingUp,
  AlertTriangle,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
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
  Button,
  Input,
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

type SortField = 'name' | 'utilization' | 'tickets' | 'hours'
type SortDirection = 'asc' | 'desc'

export function ResourceAllocationPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [sortField, setSortField] = useState<SortField>('utilization')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showOnlyOverloaded, setShowOnlyOverloaded] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  
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

    return Object.values(workloadByMember)
  }, [teamMembers, allTickets, projects, selectedProjectId])

  // Filter and sort
  const filteredAndSortedData = useMemo(() => {
    let result = [...workloadData]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(w => 
        w.member.full_name.toLowerCase().includes(query) ||
        w.member.email.toLowerCase().includes(query) ||
        w.member.role.toLowerCase().includes(query)
      )
    }
    
    // Overloaded filter
    if (showOnlyOverloaded) {
      result = result.filter(w => w.overloaded)
    }
    
    // Sort
    result.sort((a, b) => {
      let compare = 0
      switch (sortField) {
        case 'name':
          compare = a.member.full_name.localeCompare(b.member.full_name)
          break
        case 'utilization':
          compare = a.utilizationPercent - b.utilizationPercent
          break
        case 'tickets':
          compare = a.ticketCount - b.ticketCount
          break
        case 'hours':
          compare = a.totalEstimated - b.totalEstimated
          break
      }
      return sortDirection === 'desc' ? -compare : compare
    })
    
    return result
  }, [workloadData, searchQuery, showOnlyOverloaded, sortField, sortDirection])

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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-50" />
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
  }

  return (
    <PageLayout title="Resource Allocation">
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
                <p className="text-2xl font-bold">{stats.overloadedMembers}</p>
                <p className="text-sm text-muted-foreground">Overloaded</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label>Project</Label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="">All Projects</option>
            {projects?.map((p: Project) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="overloaded"
            checked={showOnlyOverloaded}
            onChange={(e) => setShowOnlyOverloaded(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="overloaded" className="text-sm cursor-pointer">
            Overloaded only ({stats.overloadedMembers})
          </Label>
        </div>

        <div className="flex items-center gap-1 ml-auto border rounded-lg p-1">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground mb-4">
        Showing {filteredAndSortedData.length} of {workloadData.length} team members
      </div>

      {/* Data Display */}
      {filteredAndSortedData.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
          title={searchQuery ? "No matching members" : "No team data"}
          description={searchQuery ? "Try adjusting your search" : "Team members with assigned tickets will appear here"}
        />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-primary">
                      Team Member <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Role</th>
                  <th className="text-center p-3 font-medium">
                    <button onClick={() => toggleSort('tickets')} className="flex items-center gap-1 hover:text-primary mx-auto">
                      Tasks <SortIcon field="tickets" />
                    </button>
                  </th>
                  <th className="text-center p-3 font-medium">
                    <button onClick={() => toggleSort('hours')} className="flex items-center gap-1 hover:text-primary mx-auto">
                      Hours <SortIcon field="hours" />
                    </button>
                  </th>
                  <th className="text-center p-3 font-medium min-w-[200px]">
                    <button onClick={() => toggleSort('utilization')} className="flex items-center gap-1 hover:text-primary mx-auto">
                      Utilization <SortIcon field="utilization" />
                    </button>
                  </th>
                  <th className="w-10 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map((workload) => {
                  const isExpanded = expandedRows.has(workload.member.id)
                  const hasProjects = Object.keys(workload.ticketsByProject).length > 0
                  
                  return (
                    <>
                      <tr 
                        key={workload.member.id} 
                        className={cn(
                          "border-t hover:bg-muted/30 transition-colors",
                          workload.overloaded && "bg-red-50 dark:bg-red-900/10"
                        )}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={workload.member.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">{getInitials(workload.member.full_name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{workload.member.full_name}</p>
                              <p className="text-xs text-muted-foreground hidden sm:block">{workload.member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs capitalize">
                            {workload.member.role.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-medium">{workload.ticketCount}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-medium">{workload.totalEstimated}h</span>
                          <span className="text-muted-foreground">/{HOURS_PER_WEEK}h</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all",
                                  workload.utilizationPercent > 100 ? "bg-red-500" :
                                  workload.utilizationPercent > 80 ? "bg-yellow-500" : "bg-green-500"
                                )}
                                style={{ width: `${Math.min(workload.utilizationPercent, 100)}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-sm font-medium w-12 text-right",
                              workload.overloaded ? "text-red-500" : "text-green-500"
                            )}>
                              {workload.utilizationPercent}%
                            </span>
                            {workload.overloaded && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {hasProjects && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpand(workload.member.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasProjects && (
                        <tr key={`${workload.member.id}-expanded`}>
                          <td colSpan={6} className="p-3 bg-muted/20">
                            <div className="flex flex-wrap gap-2 pl-11">
                              {Object.entries(workload.ticketsByProject).map(([projectId, data]) => (
                                <Badge key={projectId} variant="secondary" className="text-xs">
                                  {data.projectName}: {data.count} tasks ({data.hours}h)
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSortedData.map((workload) => (
            <Card key={workload.member.id} className={cn(workload.overloaded && "border-red-300 dark:border-red-800")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={workload.member.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(workload.member.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{workload.member.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {workload.member.role.replace('_', ' ')}
                    </p>
                  </div>
                  {workload.overloaded && (
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{workload.ticketCount} tasks</span>
                    <span className="font-medium">{workload.totalEstimated}h / {HOURS_PER_WEEK}h</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        workload.utilizationPercent > 100 ? "bg-red-500" :
                        workload.utilizationPercent > 80 ? "bg-yellow-500" : "bg-green-500"
                      )}
                      style={{ width: `${Math.min(workload.utilizationPercent, 100)}%` }}
                    />
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-sm font-medium",
                      workload.overloaded ? "text-red-500" : "text-green-500"
                    )}>
                      {workload.utilizationPercent}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
