import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Clock, FileText, Loader2 } from 'lucide-react'
import { PageLayout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, ErrorState } from '@/components/ui/states'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { formatRelative, getInitials } from '@/lib/utils'
import type { Signoff, SignoffStatus } from '@/types'

const STATUS_CONFIG: Record<SignoffStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  delegated: { label: 'Delegated', color: 'bg-blue-100 text-blue-700', icon: Clock },
}

export function SignoffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch signoff
  const { data: signoff, isLoading, error, refetch } = useQuery({
    queryKey: ['signoff', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signoffs')
        .select(`
          *,
          assignee:profiles!signoffs_assignee_id_fkey(*),
          artifact:artifacts(*, project:projects(*))
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Signoff & { artifact: { title: string; type: string; content: string; project: { name: string; code: string } } }
    },
    enabled: !!id,
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('signoffs')
        .update({
          status: 'approved' as SignoffStatus,
          decision_at: new Date().toISOString(),
          comments: comments || null,
        })
        .eq('id', id)

      if (error) throw error

      // Update artifact status
      if (signoff?.artifact_id) {
        await supabase
          .from('artifacts')
          .update({ status: 'approved' })
          .eq('id', signoff.artifact_id)
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'approve',
        entity_type: 'signoff',
        entity_id: id,
        entity_name: signoff?.artifact?.title,
        new_values: { status: 'approved', comments },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signoff', id] })
      queryClient.invalidateQueries({ queryKey: ['signoffs'] })
      navigate('/signoffs')
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('signoffs')
        .update({
          status: 'rejected' as SignoffStatus,
          decision_at: new Date().toISOString(),
          comments: comments || null,
        })
        .eq('id', id)

      if (error) throw error

      // Update artifact status
      if (signoff?.artifact_id) {
        await supabase
          .from('artifacts')
          .update({ status: 'rejected' })
          .eq('id', signoff.artifact_id)
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'reject',
        entity_type: 'signoff',
        entity_id: id,
        entity_name: signoff?.artifact?.title,
        new_values: { status: 'rejected', comments },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signoff', id] })
      queryClient.invalidateQueries({ queryKey: ['signoffs'] })
      navigate('/signoffs')
    },
  })

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      await approveMutation.mutateAsync()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!comments.trim()) {
      alert('Please provide comments for rejection')
      return
    }
    setIsSubmitting(true)
    try {
      await rejectMutation.mutateAsync()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Sign-off Details">
        <LoadingState message="Loading signoff..." />
      </PageLayout>
    )
  }

  if (error || !signoff) {
    return (
      <PageLayout title="Sign-off Details">
        <ErrorState message="Failed to load signoff" onRetry={refetch} />
      </PageLayout>
    )
  }

  const statusConfig = STATUS_CONFIG[signoff.status]
  const StatusIcon = statusConfig.icon
  const canDecide = signoff.status === 'pending' && signoff.assignee_id === user?.id

  return (
    <PageLayout title="Sign-off Details">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/signoffs')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Sign-offs
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Artifact preview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{signoff.artifact?.title || 'Artifact'}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {signoff.artifact?.project?.code} - {signoff.artifact?.project?.name}
                    </p>
                  </div>
                </div>
                <Badge className={statusConfig.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {signoff.artifact?.content && (
                <div className="prose prose-sm max-w-none">
                  <div className="bg-muted/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{signoff.artifact.content}</pre>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <Link to={`/artifacts/${signoff.artifact_id}`}>
                  <Button variant="outline" size="sm">
                    View Full Artifact
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Decision form */}
          {canDecide && (
            <Card>
              <CardHeader>
                <CardTitle>Your Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Comments</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add comments (required for rejection)..."
                    rows={4}
                    className="w-full p-3 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting}
                    variant="destructive"
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Previous decision */}
          {signoff.status !== 'pending' && signoff.comments && (
            <Card>
              <CardHeader>
                <CardTitle>Decision Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{signoff.comments}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Decided on {signoff.decision_at && new Date(signoff.decision_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assignee
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={signoff.assignee?.avatar_url || undefined} />
                  <AvatarFallback>
                    {signoff.assignee ? getInitials(signoff.assignee.full_name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{signoff.assignee?.full_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{signoff.assignee?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              </div>
              {signoff.due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{new Date(signoff.due_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatRelative(signoff.created_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}
