import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Clock, CheckCircle, Send, MessageCircle } from 'lucide-react'
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
import type { Inquiry, InquiryStatus } from '@/types'

const STATUS_CONFIG: Record<InquiryStatus, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: Clock },
  answered: { label: 'Answered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: CheckCircle },
}

export function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch inquiry
  const { data: inquiry, isLoading, error, refetch } = useQuery({
    queryKey: ['inquiry', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          asker:profiles!inquiries_asked_by_fkey(*),
          answerer:profiles!inquiries_answered_by_fkey(*),
          project:projects(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Inquiry
    },
    enabled: !!id,
  })

  // Answer mutation
  const answerMutation = useMutation({
    mutationFn: async (answerText: string) => {
      const { error } = await supabase
        .from('inquiries')
        .update({
          answer: answerText,
          answered_by: user?.id,
          answered_at: new Date().toISOString(),
          status: 'answered' as InquiryStatus,
        })
        .eq('id', id)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'answer',
        entity_type: 'inquiry',
        entity_id: id,
        entity_name: inquiry?.subject,
        new_values: { answer: answerText },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      setAnswer('')
    },
  })

  // Close mutation
  const closeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('inquiries')
        .update({ status: 'closed' as InquiryStatus })
        .eq('id', id)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'close',
        entity_type: 'inquiry',
        entity_id: id,
        entity_name: inquiry?.subject,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiry', id] })
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
    },
  })

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return
    setIsSubmitting(true)
    try {
      await answerMutation.mutateAsync(answer)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Inquiry Details">
        <LoadingState message="Loading inquiry..." />
      </PageLayout>
    )
  }

  if (error || !inquiry) {
    return (
      <PageLayout title="Inquiry Details">
        <ErrorState message="Failed to load inquiry" onRetry={refetch} />
      </PageLayout>
    )
  }

  const statusConfig = STATUS_CONFIG[inquiry.status]
  const StatusIcon = statusConfig.icon
  const canAnswer = inquiry.status === 'open' && user

  return (
    <PageLayout
      title="Inquiry Details"
      actions={
        <div className="flex gap-2">
          {inquiry.status === 'answered' && (
            <Button
              variant="outline"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              Mark as Closed
            </Button>
          )}
        </div>
      }
    >
      {/* Back button */}
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/inquiries')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Inquiries
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={inquiry.asker?.avatar_url || undefined} />
                    <AvatarFallback>
                      {inquiry.asker ? getInitials(inquiry.asker.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{inquiry.asker?.full_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      Asked {formatRelative(inquiry.created_at)}
                    </p>
                  </div>
                </div>
                <Badge className={statusConfig.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              <CardTitle className="text-xl mt-4">{inquiry.subject}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{inquiry.body}</p>
              {inquiry.is_internal && (
                <Badge variant="outline" className="mt-4">Internal</Badge>
              )}
            </CardContent>
          </Card>

          {/* Answer */}
          {inquiry.answer && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={inquiry.answerer?.avatar_url || undefined} />
                    <AvatarFallback>
                      {inquiry.answerer ? getInitials(inquiry.answerer.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{inquiry.answerer?.full_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      Answered {inquiry.answered_at && formatRelative(inquiry.answered_at)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{inquiry.answer}</p>
              </CardContent>
            </Card>
          )}

          {/* Answer form */}
          {canAnswer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Your Answer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitAnswer}>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    rows={5}
                    className="w-full p-3 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <div className="flex justify-end mt-4">
                    <Button type="submit" disabled={isSubmitting || !answer.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Project info */}
          {inquiry.project && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Related Project
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  to={`/projects/${inquiry.project.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {inquiry.project.code} - {inquiry.project.name}
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Meta info */}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(inquiry.created_at).toLocaleDateString()}</span>
              </div>
              {inquiry.answered_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Answered</span>
                  <span>{new Date(inquiry.answered_at).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}
