import { useState, useMemo } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  Input,
} from '@/components/ui'
import { useProjects, useTickets } from '@/hooks/api'
import { cn } from '@/lib/utils'
import type { Project, Ticket } from '@/types'

// Hourly rate for budget calculations (can be made configurable)
const HOURLY_RATE = 350000 // IDR

interface ProjectBudget {
  project: Project
  estimatedBudget: number
  estimatedHours: number
  loggedHours: number
  actualCost: number
  budgetUsedPercent: number
  hoursUsedPercent: number
  isOverBudget: boolean
  isOverHours: boolean
  ticketCount: number
  completedTickets: number
}

export function BudgetTrackingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'budget' | 'used'>('used')
  const [showOnlyOverBudget, setShowOnlyOverBudget] = useState(false)
  
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects()
  const { data: allTickets, isLoading: ticketsLoading } = useTickets()

  // Calculate budget data for each project
  const budgetData = useMemo(() => {
    if (!projects || !allTickets) return []

    return projects.map((project: Project) => {
      const projectTickets = allTickets.filter((t: Ticket) => t.project_id === project.id)
      
      const estimatedHours = projectTickets.reduce((sum: number, t: Ticket) => 
        sum + (t.estimated_hours || 0), 0
      )
      const loggedHours = projectTickets.reduce((sum: number, t: Ticket) => 
        sum + (t.logged_hours || 0), 0
      )
      
      const estimatedBudget = project.estimated_budget || (estimatedHours * HOURLY_RATE)
      const actualCost = loggedHours * HOURLY_RATE
      
      const budgetUsedPercent = estimatedBudget > 0 
        ? Math.round((actualCost / estimatedBudget) * 100) 
        : 0
      const hoursUsedPercent = estimatedHours > 0 
        ? Math.round((loggedHours / estimatedHours) * 100) 
        : 0
      
      const ticketCount = projectTickets.length
      const completedTickets = projectTickets.filter((t: Ticket) => t.status === 'done').length

      return {
        project,
        estimatedBudget,
        estimatedHours,
        loggedHours,
        actualCost,
        budgetUsedPercent,
        hoursUsedPercent,
        isOverBudget: actualCost > estimatedBudget,
        isOverHours: loggedHours > estimatedHours,
        ticketCount,
        completedTickets,
      } as ProjectBudget
    })
  }, [projects, allTickets])

  // Filter and sort
  const filteredData = useMemo(() => {
    let result = [...budgetData]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(b => 
        b.project.name.toLowerCase().includes(query) ||
        b.project.code.toLowerCase().includes(query)
      )
    }
    
    // Over budget filter
    if (showOnlyOverBudget) {
      result = result.filter(b => b.isOverBudget || b.isOverHours)
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.project.name.localeCompare(b.project.name)
        case 'budget':
          return b.estimatedBudget - a.estimatedBudget
        case 'used':
          return b.budgetUsedPercent - a.budgetUsedPercent
        default:
          return 0
      }
    })
    
    return result
  }, [budgetData, searchQuery, showOnlyOverBudget, sortBy])

  // Summary stats
  const stats = useMemo(() => {
    const totalEstimated = budgetData.reduce((sum, b) => sum + b.estimatedBudget, 0)
    const totalActual = budgetData.reduce((sum, b) => sum + b.actualCost, 0)
    const totalHoursEstimated = budgetData.reduce((sum, b) => sum + b.estimatedHours, 0)
    const totalHoursLogged = budgetData.reduce((sum, b) => sum + b.loggedHours, 0)
    const overBudgetCount = budgetData.filter(b => b.isOverBudget).length
    const overHoursCount = budgetData.filter(b => b.isOverHours).length
    
    return { totalEstimated, totalActual, totalHoursEstimated, totalHoursLogged, overBudgetCount, overHoursCount }
  }, [budgetData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const isLoading = projectsLoading || ticketsLoading

  if (isLoading) {
    return (
      <PageLayout title="Budget Tracking">
        <LoadingState message="Loading budget data..." />
      </PageLayout>
    )
  }

  if (projectsError) {
    return (
      <PageLayout title="Budget Tracking">
        <ErrorState message="Failed to load projects" />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Budget Tracking">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalEstimated)}</p>
                <p className="text-sm text-muted-foreground">Total Budget</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                stats.totalActual > stats.totalEstimated 
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                  : "bg-green-100 text-green-600 dark:bg-green-900/30"
              )}>
                {stats.totalActual > stats.totalEstimated ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalActual)}</p>
                <p className="text-sm text-muted-foreground">Actual Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.totalHoursLogged}h / {stats.totalHoursEstimated}h</p>
                <p className="text-sm text-muted-foreground">Hours Used</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                stats.overBudgetCount > 0 
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                  : "bg-green-100 text-green-600 dark:bg-green-900/30"
              )}>
                {stats.overBudgetCount > 0 ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-lg font-bold">{stats.overBudgetCount}</p>
                <p className="text-sm text-muted-foreground">Over Budget</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="pl-9"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'budget' | 'used')}
          className="px-3 py-2 border rounded-lg bg-background text-sm"
        >
          <option value="used">Sort by Usage %</option>
          <option value="budget">Sort by Budget</option>
          <option value="name">Sort by Name</option>
        </select>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyOverBudget}
            onChange={(e) => setShowOnlyOverBudget(e.target.checked)}
            className="rounded"
          />
          Over budget only
        </label>
      </div>

      {/* Project Budget List */}
      {filteredData.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-12 w-12 text-muted-foreground" />}
          title="No projects found"
          description="Create projects with budget estimates to track spending"
        />
      ) : (
        <div className="grid gap-4">
          {filteredData.map((item) => (
            <Card 
              key={item.project.id}
              className={cn(
                item.isOverBudget && "border-red-300 dark:border-red-800"
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Project Info */}
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.project.name}</h3>
                      {item.isOverBudget && (
                        <Badge variant="destructive" className="text-xs">Over Budget</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.project.code}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.completedTickets}/{item.ticketCount} tickets completed
                    </p>
                  </div>

                  {/* Budget Progress */}
                  <div className="flex-1 space-y-2">
                    {/* Budget Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">
                          {formatCurrency(item.actualCost)} / {formatCurrency(item.estimatedBudget)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            item.budgetUsedPercent > 100 ? "bg-red-500" :
                            item.budgetUsedPercent > 80 ? "bg-yellow-500" : "bg-green-500"
                          )}
                          style={{ width: `${Math.min(item.budgetUsedPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Hours Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Hours</span>
                        <span className="font-medium">
                          {item.loggedHours}h / {item.estimatedHours}h
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            item.hoursUsedPercent > 100 ? "bg-red-500" :
                            item.hoursUsedPercent > 80 ? "bg-yellow-500" : "bg-blue-500"
                          )}
                          style={{ width: `${Math.min(item.hoursUsedPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Percentage Display */}
                  <div className="flex gap-4 lg:flex-col lg:text-right">
                    <div>
                      <p className={cn(
                        "text-lg font-bold",
                        item.budgetUsedPercent > 100 ? "text-red-500" :
                        item.budgetUsedPercent > 80 ? "text-yellow-600" : "text-green-500"
                      )}>
                        {item.budgetUsedPercent}%
                      </p>
                      <p className="text-xs text-muted-foreground">Budget</p>
                    </div>
                    <div>
                      <p className={cn(
                        "text-lg font-bold",
                        item.hoursUsedPercent > 100 ? "text-red-500" :
                        item.hoursUsedPercent > 80 ? "text-yellow-600" : "text-blue-500"
                      )}>
                        {item.hoursUsedPercent}%
                      </p>
                      <p className="text-xs text-muted-foreground">Hours</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Note */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <p><strong>Note:</strong> Budget calculations use hourly rate of {formatCurrency(HOURLY_RATE)}/hour. 
        Actual cost is calculated from logged hours on tickets.</p>
      </div>
    </PageLayout>
  )
}
