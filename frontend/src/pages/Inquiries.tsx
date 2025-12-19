import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageCircle,
  Plus,
  Search,
  CheckCircle,
  Clock,
  ArrowRight,
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
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { formatRelative, getInitials } from '@/lib/utils'
import type { Inquiry, InquiryStatus } from '@/types'

const STATUS_COLORS: Record<InquiryStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  answered: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
}

function useInquiries() {
  return useQuery({
    queryKey: ['inquiries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          asker:profiles!inquiries_asked_by_fkey(*),
          answerer:profiles!inquiries_answered_by_fkey(*),
          project:projects(*)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Inquiry[]
    },
  })
}

function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={inquiry.asker?.avatar_url || undefined} />
              <AvatarFallback>
                {inquiry.asker ? getInitials(inquiry.asker.full_name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{inquiry.asker?.full_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelative(inquiry.created_at)}
                {inquiry.project && ` • ${inquiry.project.name}`}
              </p>
            </div>
          </div>
          <Badge className={STATUS_COLORS[inquiry.status]}>
            {inquiry.status === 'open' && <Clock className="h-3 w-3 mr-1" />}
            {inquiry.status === 'answered' && <CheckCircle className="h-3 w-3 mr-1" />}
            {inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
          </Badge>
        </div>

        <h3 className="font-semibold text-lg mb-2">{inquiry.subject}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {inquiry.body}
        </p>

        {/* Answer preview */}
        {inquiry.answer && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={inquiry.answerer?.avatar_url || undefined} />
                <AvatarFallback>
                  {inquiry.answerer ? getInitials(inquiry.answerer.full_name) : '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {inquiry.answerer?.full_name || 'Unknown'}
              </span>
              <span className="text-xs text-muted-foreground">
                {inquiry.answered_at && formatRelative(inquiry.answered_at)}
              </span>
            </div>
            <p className="text-sm line-clamp-2">{inquiry.answer}</p>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {inquiry.is_internal && (
              <Badge variant="outline">Internal</Badge>
            )}
          </div>
          <Link
            to={`/inquiries/${inquiry.id}`}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View details <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function InquiriesPage() {
  const { hasMinimumRole } = useAuthStore()
  const { data: inquiries, isLoading, error, refetch } = useInquiries()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'all'>('all')

  const canCreate = hasMinimumRole('developer')

  const filteredInquiries = inquiries?.filter((inquiry) => {
    const matchesSearch =
      inquiry.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.body.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const openCount = inquiries?.filter(i => i.status === 'open').length || 0
  const answeredCount = inquiries?.filter(i => i.status === 'answered').length || 0

  return (
    <PageLayout
      title="Inquiries"
      actions={
        canCreate && (
          <Link to="/inquiries/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Inquiry
            </Button>
          </Link>
        )
      }
    >
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setStatusFilter('open')}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-sm text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setStatusFilter('answered')}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{answeredCount}</p>
              <p className="text-sm text-muted-foreground">Answered</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inquiries?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search inquiries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InquiryStatus | 'all')}
          className="px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="answered">Answered</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Content */}
      {isLoading && <LoadingState message="Loading inquiries..." />}
      
      {error && (
        <ErrorState
          message="Failed to load inquiries"
          onRetry={() => refetch()}
        />
      )}
      
      {!isLoading && !error && (!filteredInquiries || filteredInquiries.length === 0) && (
        <EmptyState
          icon={<MessageCircle className="h-12 w-12 text-muted-foreground" />}
          title="No inquiries found"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Ask your first question to get started'
          }
          action={
            canCreate && !searchQuery && statusFilter === 'all'
              ? {
                  label: 'New Inquiry',
                  onClick: () => {},
                }
              : undefined
          }
        />
      )}

      {!isLoading && !error && filteredInquiries && filteredInquiries.length > 0 && (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => (
            <InquiryCard key={inquiry.id} inquiry={inquiry} />
          ))}
        </div>
      )}
    </PageLayout>
  )
}
