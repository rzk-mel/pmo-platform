import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  MessageSquare,
  FileText,
  CheckSquare,
  Ticket,
  FolderKanban,
  UserPlus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Upload,
  GitBranch,
  AtSign,
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
import { useProjects } from '@/hooks/api'
import { supabase } from '@/lib/supabase'
import { cn, formatRelative, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Activity as ActivityType, Project, Profile } from '@/types'

// Icon mapping for activity types
const ACTION_ICONS: Record<string, React.ElementType> = {
  created: FileText,
  updated: Edit,
  deleted: Trash2,
  commented: MessageSquare,
  mentioned: AtSign,
  status_changed: Activity,
  assigned: UserPlus,
  completed: CheckCircle,
  approved: CheckCircle,
  rejected: XCircle,
  uploaded: Upload,
  synced: GitBranch,
  signed_off: CheckSquare,
}

const ACTION_COLORS: Record<string, string> = {
  created: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  updated: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  deleted: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  commented: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
  mentioned: 'text-pink-500 bg-pink-100 dark:bg-pink-900/30',
  status_changed: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
  assigned: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30',
  completed: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  approved: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  rejected: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  uploaded: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30',
  synced: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
  signed_off: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  project: FolderKanban,
  artifact: FileText,
  ticket: Ticket,
  inquiry: MessageSquare,
  signoff: CheckSquare,
  comment: MessageSquare,
}

// Get link for entity
function getEntityLink(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'project': return `/projects/${entityId}`
    case 'artifact': return `/artifacts/${entityId}`
    case 'ticket': return `/tickets/${entityId}/edit`
    case 'inquiry': return `/inquiries/${entityId}`
    default: return null
  }
}

// Format action label
function getActionLabel(action: string, entityType: string): string {
  const labels: Record<string, string> = {
    created: `created a new ${entityType}`,
    updated: `updated ${entityType}`,
    deleted: `deleted ${entityType}`,
    commented: `commented on ${entityType}`,
    mentioned: `mentioned you in ${entityType}`,
    status_changed: `changed status of ${entityType}`,
    assigned: `assigned ${entityType}`,
    completed: `completed ${entityType}`,
    approved: `approved ${entityType}`,
    rejected: `rejected ${entityType}`,
    uploaded: `uploaded ${entityType}`,
    synced: `synced ${entityType}`,
    signed_off: `signed off ${entityType}`,
  }
  return labels[action] || `${action} ${entityType}`
}

export function ActivityStreamPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<'all' | '7' | '30'>('7')
  
  const queryClient = useQueryClient()
  const { data: projects, isLoading: projectsLoading } = useProjects()

  // Fetch activities
  const { data: activities, isLoading: activitiesLoading, error } = useQuery({
    queryKey: ['activities', selectedProjectId, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select(`
          *,
          actor:actor_id (id, full_name, avatar_url, role),
          project:project_id (id, name, code)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (selectedProjectId) {
        query = query.eq('project_id', selectedProjectId)
      }
      
      if (dateFilter !== 'all') {
        const daysAgo = new Date()
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter))
        query = query.gte('created_at', daysAgo.toISOString())
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data as (ActivityType & { actor: Profile; project: Project })[]
    },
  })

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('activities-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activities'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Group activities by date
  const groupedActivities = useMemo(() => {
    if (!activities) return {}
    
    return activities.reduce((groups, activity) => {
      const date = new Date(activity.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      
      if (!groups[date]) groups[date] = []
      groups[date].push(activity)
      return groups
    }, {} as Record<string, typeof activities>)
  }, [activities])

  const isLoading = projectsLoading || activitiesLoading

  if (isLoading) {
    return (
      <PageLayout title="Activity Stream">
        <LoadingState message="Loading activities..." />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Activity Stream">
        <ErrorState message="Failed to load activities" />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Activity Stream">
      <div className="mb-6">
        <p className="text-muted-foreground">
          See all recent activities across your projects
        </p>
      </div>

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
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'all' | '7' | '30')}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {activities?.length || 0} activities
        </div>
      </div>

      {/* Activity Feed */}
      {!activities || activities.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-12 w-12 text-muted-foreground" />}
          title="No activities yet"
          description="Activities will appear here as your team works on projects"
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 sticky top-0 bg-background py-2">
                {date}
              </h3>
              <div className="space-y-3">
                {dayActivities.map((activity) => {
                  const ActionIcon = ACTION_ICONS[activity.action] || Activity
                  const EntityIcon = ENTITY_ICONS[activity.entity_type] || FileText
                  const entityLink = getEntityLink(activity.entity_type, activity.entity_id)
                  
                  return (
                    <Card key={activity.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Action Icon */}
                          <div className={cn(
                            "p-2 rounded-full shrink-0",
                            ACTION_COLORS[activity.action] || 'bg-muted text-muted-foreground'
                          )}>
                            <ActionIcon className="h-4 w-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Actor */}
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={activity.actor?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(activity.actor?.full_name || 'System')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">
                                  {activity.actor?.full_name || 'System'}
                                </span>
                              </div>

                              {/* Action */}
                              <span className="text-sm text-muted-foreground">
                                {getActionLabel(activity.action, activity.entity_type)}
                              </span>
                            </div>

                            {/* Entity info */}
                            <div className="mt-2 flex items-center gap-2">
                              <EntityIcon className="h-4 w-4 text-muted-foreground" />
                              {entityLink ? (
                                <Link
                                  to={entityLink}
                                  className="text-sm font-medium hover:text-primary transition-colors"
                                >
                                  {activity.entity_name || activity.entity_id}
                                </Link>
                              ) : (
                                <span className="text-sm">
                                  {activity.entity_name || activity.entity_id}
                                </span>
                              )}
                            </div>

                            {/* Project badge */}
                            {activity.project && (
                              <div className="mt-2">
                                <Badge variant="outline" className="text-xs">
                                  <FolderKanban className="h-3 w-3 mr-1" />
                                  {activity.project.name}
                                </Badge>
                              </div>
                            )}

                            {/* Metadata */}
                            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {(activity.metadata as { old_status?: string; new_status?: string }).old_status && 
                                 (activity.metadata as { old_status?: string; new_status?: string }).new_status && (
                                  <span>
                                    Status: {(activity.metadata as { old_status?: string; new_status?: string }).old_status} → {(activity.metadata as { old_status?: string; new_status?: string }).new_status}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Time */}
                          <div className="text-xs text-muted-foreground shrink-0">
                            {formatRelative(activity.created_at)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
