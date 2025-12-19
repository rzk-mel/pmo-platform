import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutGrid,
  GripVertical,
  Plus,
  Calendar,
  Clock,
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
import { supabase } from '@/lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { Project, Ticket, TicketStatus, TicketPriority } from '@/types'

// Kanban columns configuration
const COLUMNS: { id: TicketStatus; label: string; color: string }[] = [
  { id: 'open', label: 'Open', color: 'bg-slate-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'review', label: 'Review', color: 'bg-purple-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
]

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500',
}

const PRIORITY_BADGES: Record<TicketPriority, 'default' | 'secondary' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  critical: 'destructive',
}

interface TicketCardProps {
  ticket: Ticket
  onDragStart: (e: React.DragEvent, ticket: Ticket) => void
}

function TicketCard({ ticket, onDragStart }: TicketCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, ticket)}
      className={cn(
        "bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
        "border-l-4",
        PRIORITY_COLORS[ticket.priority]
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <Link
            to={`/tickets/${ticket.id}/edit`}
            className="font-medium text-sm hover:text-primary transition-colors line-clamp-2"
            onClick={(e) => e.stopPropagation()}
          >
            {ticket.title}
          </Link>
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={PRIORITY_BADGES[ticket.priority]} className="text-xs">
              {ticket.priority}
            </Badge>
            
            {ticket.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(ticket.due_date).toLocaleDateString()}
              </span>
            )}
            
            {ticket.estimated_hours && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {ticket.estimated_hours}h
              </span>
            )}
          </div>

          {ticket.labels && ticket.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ticket.labels.slice(0, 3).map((label, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 bg-muted rounded">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  column: typeof COLUMNS[0]
  tickets: Ticket[]
  onDragStart: (e: React.DragEvent, ticket: Ticket) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, status: TicketStatus) => void
  isDragOver: boolean
}

function KanbanColumn({ column, tickets, onDragStart, onDragOver, onDrop, isDragOver }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] flex-1">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-3 h-3 rounded-full", column.color)} />
        <h3 className="font-semibold">{column.label}</h3>
        <Badge variant="secondary" className="ml-auto">
          {tickets.length}
        </Badge>
      </div>
      
      {/* Column Content */}
      <div
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, column.id)}
        className={cn(
          "flex-1 bg-muted/30 rounded-lg p-2 space-y-2 min-h-[400px] transition-colors",
          isDragOver && "bg-primary/10 border-2 border-dashed border-primary"
        )}
      >
        {tickets.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No tickets
          </div>
        ) : (
          tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function KanbanBoardPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [dragOverColumn, setDragOverColumn] = useState<TicketStatus | null>(null)
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('')
  
  const queryClient = useQueryClient()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: allTickets, isLoading: ticketsLoading, error: ticketsError } = useTickets()

  // Filter tickets by project
  const projectTickets = allTickets?.filter((t: Ticket) => 
    selectedProjectId ? t.project_id === selectedProjectId : true
  ) || []

  // Apply additional filters
  const filteredTickets = projectTickets.filter((t: Ticket) => {
    if (assigneeFilter && t.assignee_id !== assigneeFilter) return false
    if (priorityFilter && t.priority !== priorityFilter) return false
    return true
  })

  // Group tickets by status
  const ticketsByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredTickets.filter((t: Ticket) => t.status === col.id)
    return acc
  }, {} as Record<TicketStatus, Ticket[]>)

  // Update ticket status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          status,
          completed_at: status === 'done' ? new Date().toISOString() : null
        })
        .eq('id', ticketId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicket(ticket)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, newStatus: TicketStatus) => {
    e.preventDefault()
    setDragOverColumn(null)
    
    if (draggedTicket && draggedTicket.status !== newStatus) {
      updateStatusMutation.mutate({ ticketId: draggedTicket.id, status: newStatus })
    }
    setDraggedTicket(null)
  }

  const handleDragEnter = (status: TicketStatus) => {
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  // Get unique assignees for filter
  const assignees = [...new Set(projectTickets.map((t: Ticket) => t.assignee_id).filter(Boolean))]

  const isLoading = projectsLoading || ticketsLoading

  if (isLoading) {
    return (
      <PageLayout title="Kanban Board">
        <LoadingState message="Loading board..." />
      </PageLayout>
    )
  }

  if (ticketsError) {
    return (
      <PageLayout title="Kanban Board">
        <ErrorState message="Failed to load tickets" />
      </PageLayout>
    )
  }

  return (
    <PageLayout 
      title="Kanban Board"
      actions={
        <Link to={`/tickets/new${selectedProjectId ? `?projectId=${selectedProjectId}` : ''}`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </Link>
      }
    >
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
          <Label>Priority</Label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | '')}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredTickets.length} tickets
        </div>
      </div>

      {/* Kanban Board */}
      {filteredTickets.length === 0 && !selectedProjectId ? (
        <EmptyState
          icon={<LayoutGrid className="h-12 w-12 text-muted-foreground" />}
          title="No tickets yet"
          description="Create your first ticket to get started with the Kanban board"
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              onDragEnter={() => handleDragEnter(column.id)}
              onDragLeave={handleDragLeave}
            >
              <KanbanColumn
                column={column}
                tickets={ticketsByStatus[column.id] || []}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragOver={dragOverColumn === column.id}
              />
            </div>
          ))}
        </div>
      )}

      {/* Update status indicator */}
      {updateStatusMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
          Updating...
        </div>
      )}
    </PageLayout>
  )
}
