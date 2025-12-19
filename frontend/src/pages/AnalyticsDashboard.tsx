import { useState, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  LoadingState,
  ErrorState,
  Label,
} from '@/components/ui'
import { useProjects, useTickets } from '@/hooks/api'
import type { Project, Ticket, TicketStatus } from '@/types'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// Status colors for charts
const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#64748b',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  review: '#a855f7',
  done: '#22c55e',
  cancelled: '#9ca3af',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
}

export function AnalyticsDashboardPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30')
  
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: allTickets, isLoading: ticketsLoading, error } = useTickets()

  // Filter tickets by project
  const projectTickets = useMemo(() => {
    if (!allTickets) return []
    return selectedProjectId 
      ? allTickets.filter((t: Ticket) => t.project_id === selectedProjectId)
      : allTickets
  }, [allTickets, selectedProjectId])

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    projectTickets.forEach((t: Ticket) => {
      counts[t.status] = (counts[t.status] || 0) + 1
    })
    
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status as TicketStatus] || status,
      value: count,
      color: STATUS_COLORS[status as TicketStatus] || '#999',
    }))
  }, [projectTickets])

  // Velocity data (completed tickets per week)
  const velocityData = useMemo(() => {
    const days = parseInt(dateRange)
    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    
    // Group completed tickets by week
    const weeks: Record<string, number> = {}
    
    projectTickets
      .filter((t: Ticket) => t.status === 'done' && t.completed_at)
      .forEach((t: Ticket) => {
        const completedDate = new Date(t.completed_at!)
        if (completedDate >= startDate) {
          // Get week start date
          const weekStart = new Date(completedDate)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          const weekKey = weekStart.toISOString().split('T')[0]
          weeks[weekKey] = (weeks[weekKey] || 0) + 1
        }
      })
    
    // Convert to array and sort
    return Object.entries(weeks)
      .map(([week, count]) => ({
        week: new Date(week).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        completed: count,
      }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime())
      .slice(-8) // Last 8 weeks max
  }, [projectTickets, dateRange])

  // Burndown data (remaining work over time)
  const burndownData = useMemo(() => {
    const days = parseInt(dateRange)
    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    
    // Calculate total estimated hours at start
    const totalHours = projectTickets.reduce((sum: number, t: Ticket) => 
      sum + (t.estimated_hours || 0), 0
    )
    
    // Generate data points
    const data: Array<{ date: string; remaining: number; ideal: number }> = []
    const daysCount = Math.min(days, 30) // Max 30 data points
    const interval = Math.max(1, Math.floor(days / daysCount))
    
    for (let i = 0; i <= daysCount; i++) {
      const date = new Date(startDate.getTime() + i * interval * 24 * 60 * 60 * 1000)
      
      // Count completed hours by this date
      const completedHours = projectTickets
        .filter((t: Ticket) => t.status === 'done' && t.completed_at && new Date(t.completed_at) <= date)
        .reduce((sum: number, t: Ticket) => sum + (t.estimated_hours || 0), 0)
      
      data.push({
        date: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        remaining: Math.max(0, totalHours - completedHours),
        ideal: Math.max(0, totalHours - (totalHours * i / daysCount)),
      })
    }
    
    return data
  }, [projectTickets, dateRange])

  // Summary stats
  const stats = useMemo(() => {
    const total = projectTickets.length
    const completed = projectTickets.filter((t: Ticket) => t.status === 'done').length
    const inProgress = projectTickets.filter((t: Ticket) => t.status === 'in_progress').length
    const blocked = projectTickets.filter((t: Ticket) => t.status === 'blocked').length
    const totalHours = projectTickets.reduce((sum: number, t: Ticket) => sum + (t.estimated_hours || 0), 0)
    const loggedHours = projectTickets.reduce((sum: number, t: Ticket) => sum + (t.logged_hours || 0), 0)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    // Calculate average velocity (tickets completed per week in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentCompleted = projectTickets.filter((t: Ticket) => 
      t.status === 'done' && t.completed_at && new Date(t.completed_at) >= thirtyDaysAgo
    ).length
    const avgVelocity = Math.round(recentCompleted / 4.3) // ~4.3 weeks in 30 days
    
    return { total, completed, inProgress, blocked, totalHours, loggedHours, completionRate, avgVelocity }
  }, [projectTickets])

  const isLoading = projectsLoading || ticketsLoading

  if (isLoading) {
    return (
      <PageLayout title="Analytics Dashboard">
        <LoadingState message="Loading analytics..." />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Analytics Dashboard">
        <ErrorState message="Failed to load data" />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Analytics Dashboard">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
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

        <div className="flex items-center gap-2">
          <Label>Period</Label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7' | '30' | '90')}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completionRate}%</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgVelocity}</p>
                <p className="text-sm text-muted-foreground">Velocity/week</p>
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
                <p className="text-2xl font-bold">{stats.loggedHours}h</p>
                <p className="text-sm text-muted-foreground">/ {stats.totalHours}h estimated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Ticket Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No ticket data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Velocity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Weekly Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {velocityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#22c55e" name="Completed Tickets" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No completion data in this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6">
        {/* Burndown Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Burndown Chart
            </CardTitle>
          </CardHeader>
          <CardContent>
            {burndownData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={burndownData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" unit="h" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="remaining" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Actual Remaining"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ideal" 
                    stroke="#9ca3af" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Ideal Burndown"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available for burndown chart
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Blocked/At Risk Section */}
      {stats.blocked > 0 && (
        <Card className="mt-6 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Blocked Tickets ({stats.blocked})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projectTickets
                .filter((t: Ticket) => t.status === 'blocked')
                .slice(0, 5)
                .map((t: Ticket) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <Badge variant="destructive">Blocked</Badge>
                    <span className="text-sm">{t.title}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  )
}
