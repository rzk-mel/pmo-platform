import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Send,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  LoadingState,
  ErrorState,
} from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useArtifact, useArtifactSignoffs } from '@/hooks/api'
import { useAuthStore } from '@/stores/auth'
import {
  ARTIFACT_STATUS_LABELS,
  ARTIFACT_STATUS_COLORS,
  formatDate,
  formatRelative,
  formatPercentage,
  getInitials,
} from '@/lib/utils'
import { approveArtifact, rejectArtifact } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function ArtifactViewerPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { user, hasMinimumRole } = useAuthStore()

  const { data: artifact, isLoading, error } = useArtifact(id!)
  const { data: signoffs } = useArtifactSignoffs(id!)

  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  // User can approve is determined by userSignoff and canTakeAction
  const userSignoff = signoffs?.find(
    s => s.assignee_id === user?.id || s.delegated_to_id === user?.id
  )
  const canTakeAction = userSignoff && userSignoff.status === 'pending'

  const approveMutation = useMutation({
    mutationFn: (signoffId: string) => approveArtifact(signoffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts', id] })
      queryClient.invalidateQueries({ queryKey: ['artifacts', id, 'signoffs'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ signoffId, comments }: { signoffId: string; comments: string }) =>
      rejectArtifact(signoffId, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts', id] })
      queryClient.invalidateQueries({ queryKey: ['artifacts', id, 'signoffs'] })
      setShowRejectModal(false)
    },
  })

  if (isLoading) {
    return (
      <PageLayout>
        <LoadingState message="Loading artifact..." />
      </PageLayout>
    )
  }

  if (error || !artifact) {
    return (
      <PageLayout>
        <ErrorState message="Artifact not found" />
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={artifact.title}
      actions={
        canTakeAction && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(true)}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => userSignoff && approveMutation.mutate(userSignoff.id)}
              isLoading={approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </div>
        )
      }
    >
      {/* Back link */}
      <Link
        to={`/projects/${artifact.project_id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Project
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={ARTIFACT_STATUS_COLORS[artifact.status]}>
                    {ARTIFACT_STATUS_LABELS[artifact.status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Version {artifact.version}
                  </span>
                </div>
                <CardTitle className="text-xl">{artifact.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {artifact.type} • Created {formatRelative(artifact.created_at)}
                </p>
              </div>
              {artifact.ai_generated && (
                <div className="flex items-center gap-2 text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                  <Sparkles className="h-4 w-4" />
                  AI Generated ({formatPercentage(artifact.ai_confidence || 0)} confidence)
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Artifact Content */}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {artifact.content ? (
                  <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg max-h-[600px] overflow-y-auto scrollbar-thin">
                    {artifact.content}
                  </div>
                ) : artifact.file_path ? (
                  <div className="flex items-center justify-center py-12 border rounded-lg">
                    <div className="text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        This artifact is stored as a file
                      </p>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download File
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No content available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{artifact.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                {artifact.creator ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={artifact.creator.avatar_url || undefined} />
                      <AvatarFallback>
                        {getInitials(artifact.creator.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{artifact.creator.full_name}</span>
                  </div>
                ) : (
                  <p className="font-medium">Unknown</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatDate(artifact.updated_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sign-offs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Sign-offs</CardTitle>
              {hasMinimumRole('project_manager') && artifact.status === 'draft' && (
                <Button size="sm" variant="outline">
                  <Send className="h-4 w-4 mr-2" />
                  Request Sign-off
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!signoffs || signoffs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No sign-offs requested yet
                </p>
              ) : (
                <div className="space-y-3">
                  {signoffs.map((signoff) => (
                    <div
                      key={signoff.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={signoff.assignee?.avatar_url || undefined} />
                          <AvatarFallback>
                            {signoff.assignee
                              ? getInitials(signoff.assignee.full_name)
                              : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {signoff.assignee?.full_name || 'Unknown'}
                          </p>
                          {signoff.decision_at && (
                            <p className="text-xs text-muted-foreground">
                              {formatRelative(signoff.decision_at)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        {signoff.status === 'pending' && (
                          <Badge variant="warning">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        {signoff.status === 'approved' && (
                          <Badge variant="success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {signoff.status === 'rejected' && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Reject Artifact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Please provide a reason for rejection. This will be visible to the author.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    userSignoff &&
                    rejectMutation.mutate({
                      signoffId: userSignoff.id,
                      comments: rejectReason,
                    })
                  }
                  disabled={!rejectReason.trim()}
                  isLoading={rejectMutation.isPending}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  )
}
