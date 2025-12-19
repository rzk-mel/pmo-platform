import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  ArrowUpRight,
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
} from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useMySignoffs } from '@/hooks/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatRelative, getInitials } from '@/lib/utils'
import { approveArtifact, rejectArtifact } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Signoff, Artifact, Project } from '@/types'

function SignoffCard({ signoff }: { signoff: Signoff }) {
  const queryClient = useQueryClient()
  const artifact = signoff.artifact as Artifact & { project?: Project }

  const approveMutation = useMutation({
    mutationFn: () => approveArtifact(signoff.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signoffs', 'mine'] })
    },
  })

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <Link
                to={`/artifacts/${artifact?.id}`}
                className="font-semibold hover:text-primary transition-colors"
              >
                {artifact?.title || 'Untitled Artifact'}
              </Link>
              <p className="text-sm text-muted-foreground">
                {artifact?.project?.name || 'Unknown Project'} • {artifact?.type}
              </p>
            </div>
          </div>
          {signoff.due_date && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Due</p>
              <p className="text-sm font-medium">
                {formatDate(signoff.due_date)}
              </p>
            </div>
          )}
        </div>

        {/* Preview snippet */}
        {artifact?.content && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {artifact.content.slice(0, 200)}...
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Link
            to={`/artifacts/${artifact?.id}`}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View Full Document <ArrowUpRight className="h-4 w-4" />
          </Link>
          <div className="flex gap-2">
            <Link to={`/artifacts/${artifact?.id}`}>
              <Button variant="outline" size="sm">
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => approveMutation.mutate()}
              isLoading={approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SignoffsPage() {
  const { data: signoffs, isLoading, error, refetch } = useMySignoffs()

  return (
    <PageLayout title="Sign-offs">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{signoffs?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {signoffs?.filter(s => {
                  if (!s.due_date) return false
                  return new Date(s.due_date) < new Date()
                }).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {signoffs?.filter(s => {
                  if (!s.due_date) return false
                  const due = new Date(s.due_date)
                  const now = new Date()
                  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                  return due > now && due <= weekFromNow
                }).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Due This Week</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {isLoading && <LoadingState message="Loading sign-offs..." />}
      
      {error && (
        <ErrorState
          message="Failed to load sign-offs"
          onRetry={() => refetch()}
        />
      )}
      
      {!isLoading && !error && (!signoffs || signoffs.length === 0) && (
        <EmptyState
          icon={<CheckCircle className="h-12 w-12 text-green-500" />}
          title="All caught up!"
          description="You have no pending sign-off requests"
        />
      )}

      {!isLoading && !error && signoffs && signoffs.length > 0 && (
        <div className="space-y-4">
          {signoffs.map((signoff) => (
            <SignoffCard key={signoff.id} signoff={signoff} />
          ))}
        </div>
      )}
    </PageLayout>
  )
}
