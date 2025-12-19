import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Eye, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { PageLayout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states'
import { supabase } from '@/lib/supabase'
import type { Artifact, ArtifactStatus, ArtifactType } from '@/types'

const STATUS_CONFIG: Record<ArtifactStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: Clock },
  pending_review: { label: 'Pending Review', variant: 'default', icon: AlertCircle },
  approved: { label: 'Approved', variant: 'outline', icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
  superseded: { label: 'Superseded', variant: 'secondary', icon: Clock },
}

const TYPE_LABELS: Record<ArtifactType, string> = {
  scope_document: 'Scope Document',
  sow: 'Statement of Work',
  technical_spec: 'Technical Spec',
  meeting_minutes: 'Meeting Minutes',
  poc_report: 'POC Report',
  test_plan: 'Test Plan',
  uat_report: 'UAT Report',
  sign_off_document: 'Sign-off Document',
  risk_assessment: 'Risk Assessment',
  other: 'Other',
}

export function ArtifactsListPage() {
  const [artifacts, setArtifacts] = useState<(Artifact & { project?: { name: string; code: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ArtifactStatus | 'all'>('all')

  useEffect(() => {
    loadArtifacts()
  }, [])

  async function loadArtifacts() {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('artifacts')
        .select(`
          *,
          project:projects(name, code)
        `)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError
      setArtifacts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts')
    } finally {
      setLoading(false)
    }
  }

  const filteredArtifacts = artifacts.filter(artifact => {
    const matchesSearch = artifact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artifact.project?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || artifact.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <PageLayout title="Artifacts">
        <LoadingState message="Loading artifacts..." />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Artifacts">
        <ErrorState message={error} onRetry={loadArtifacts} />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Artifacts">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ArtifactStatus | 'all')}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Artifacts Grid */}
      {filteredArtifacts.length === 0 ? (
        <EmptyState
          title="No artifacts found"
          description={searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Artifacts will appear here when created'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArtifacts.map((artifact) => {
            const statusConfig = STATUS_CONFIG[artifact.status]
            const StatusIcon = statusConfig.icon
            
            return (
              <Card key={artifact.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[artifact.type]}
                      </Badge>
                    </div>
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-2 line-clamp-2">{artifact.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {artifact.project && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {artifact.project.code} - {artifact.project.name}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      v{artifact.version} • {new Date(artifact.updated_at).toLocaleDateString()}
                    </span>
                    <Link to={`/artifacts/${artifact.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                  {artifact.ai_generated && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      AI Generated
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}
