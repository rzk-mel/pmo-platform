import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Button,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  Label,
} from '@/components/ui'
import { useProjects, useTickets } from '@/hooks/api'
import { cn } from '@/lib/utils'
import type { Project, Ticket, TicketPriority } from '@/types'

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-slate-400',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-slate-500',
  in_progress: 'bg-blue-500',
  review: 'bg-purple-500',
  done: 'bg-green-500',
  blocked: 'bg-red-500',
  cancelled: 'bg-gray-400',
}

// Get all days in a range
function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const current = new Date(start)
  while (current <= end) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return days
}

interface GanttBarProps {
  ticket: Ticket
  viewStart: Date
  dayWidth: number
  colorBy: 'priority' | 'status'
}

function GanttBar({ ticket, viewStart, dayWidth, colorBy }: GanttBarProps) {
  const ticketStart = new Date(ticket.created_at)
  const ticketEnd = ticket.due_date ? new Date(ticket.due_date) : new Date(ticketStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  // Calculate position
  const startOffset = Math.max(0, Math.floor((ticketStart.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)))
  const duration = Math.max(1, Math.ceil((ticketEnd.getTime() - ticketStart.getTime()) / (1000 * 60 * 60 * 24)))
  
  const left = startOffset * dayWidth
  const width = duration * dayWidth
  
  const bgColor = colorBy === 'priority' ? PRIORITY_COLORS[ticket.priority] : STATUS_COLORS[ticket.status]
  
  return (
    <Link
      to={`/tickets/${ticket.id}/edit`}
      className={cn(
        "absolute h-6 rounded flex items-center px-2 text-white text-xs font-medium truncate hover:opacity-80 transition-opacity cursor-pointer",
        bgColor
      )}
      style={{ left: `${left}px`, width: `${Math.max(width, dayWidth)}px`, top: '50%', transform: 'translateY(-50%)' }}
      title={`${ticket.title} (${ticket.status})`}
    >
      {ticket.title}
    </Link>
  )
}

export function GanttChartPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month')
  const [colorBy, setColorBy] = useState<'priority' | 'status'>('priority')
  
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: allTickets, isLoading: ticketsLoading, error: ticketsError } = useTickets()

  // Filter tickets by project
  const projectTickets = useMemo(() => {
    const filtered = allTickets?.filter((t: Ticket) => 
      selectedProjectId ? t.project_id === selectedProjectId : true
    ) || []
    
    // Sort by due date
    return filtered.sort((a: Ticket, b: Ticket) => {
      const aDate = a.due_date ? new Date(a.due_date).getTime() : 0
      const bDate = b.due_date ? new Date(b.due_date).getTime() : 0
      return aDate - bDate
    })
  }, [allTickets, selectedProjectId])

  // Calculate view range
  const viewRange = useMemo(() => {
    if (viewMode === 'week') {
      const start = new Date(currentDate)
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      
      return { start, end, days: getDaysInRange(start, end) }
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      return { start, end, days: getDaysInRange(start, end) }
    }
  }, [currentDate, viewMode])

  const dayWidth = viewMode === 'week' ? 100 : 30

  // Navigation
  const goToPrev = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() - 7)
      } else {
        newDate.setMonth(newDate.getMonth() - 1)
      }
      return newDate
    })
  }

  const goToNext = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + 7)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const isLoading = projectsLoading || ticketsLoading

  if (isLoading) {
    return (
      <PageLayout title="Gantt Chart">
        <LoadingState message="Loading timeline..." />
      </PageLayout>
    )
  }

  if (ticketsError) {
    return (
      <PageLayout title="Gantt Chart">
        <ErrorState message="Failed to load tickets" />
      </PageLayout>
    )
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <PageLayout title="Gantt Chart">
      {/* Controls */}
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
          <Label>View</Label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'week' | 'month')}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Label>Color by</Label>
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as 'priority' | 'status')}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="priority">Priority</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={goToPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Period Label */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{monthName}</h2>
      </div>

      {/* Gantt Chart */}
      {projectTickets.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
          title="No tickets to display"
          description="Create tickets with due dates to see them on the timeline"
          action={
            <Link to="/tickets/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Header - Days */}
          <div className="flex border-b bg-muted/50 sticky top-0 z-10">
            <div className="w-64 shrink-0 p-3 font-semibold border-r bg-muted">
              Ticket
            </div>
            <div className="flex overflow-x-auto">
              {viewRange.days.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString()
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <div
                    key={i}
                    className={cn(
                      "shrink-0 p-2 text-center text-xs border-r",
                      isToday && "bg-primary/10 font-bold",
                      isWeekend && "bg-muted/50"
                    )}
                    style={{ width: `${dayWidth}px` }}
                  >
                    <div className={cn(isToday && "text-primary")}>
                      {day.getDate()}
                    </div>
                    <div className="text-muted-foreground">
                      {day.toLocaleDateString('en', { weekday: 'short' })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rows - Tickets */}
          <div className="max-h-[500px] overflow-y-auto">
            {projectTickets.map((ticket: Ticket) => (
              <div key={ticket.id} className="flex border-b hover:bg-muted/20">
                <div className="w-64 shrink-0 p-3 border-r flex items-center gap-2">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {ticket.priority}
                  </Badge>
                  <Link
                    to={`/tickets/${ticket.id}/edit`}
                    className="text-sm truncate hover:text-primary transition-colors"
                  >
                    {ticket.title}
                  </Link>
                </div>
                <div 
                  className="relative flex-1"
                  style={{ minWidth: `${viewRange.days.length * dayWidth}px`, height: '48px' }}
                >
                  <GanttBar
                    ticket={ticket}
                    viewStart={viewRange.start}
                    dayWidth={dayWidth}
                    colorBy={colorBy}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        {colorBy === 'priority' ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" /> Critical
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500" /> High
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" /> Medium
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-400" /> Low
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-500" /> Open
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" /> In Progress
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500" /> Review
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" /> Done
            </div>
          </>
        )}
      </div>
    </PageLayout>
  )
}
