import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { PageLayout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { ArtifactType, ArtifactStatus } from '@/types'

const ARTIFACT_TYPES: { value: ArtifactType; label: string }[] = [
  { value: 'scope_document', label: 'Scope Document' },
  { value: 'sow', label: 'Statement of Work' },
  { value: 'technical_spec', label: 'Technical Specification' },
  { value: 'meeting_minutes', label: 'Meeting Minutes' },
  { value: 'poc_report', label: 'POC Report' },
  { value: 'test_plan', label: 'Test Plan' },
  { value: 'uat_report', label: 'UAT Report' },
  { value: 'sign_off_document', label: 'Sign-off Document' },
  { value: 'risk_assessment', label: 'Risk Assessment' },
  { value: 'other', label: 'Other' },
]

interface FormData {
  title: string
  type: ArtifactType
  content: string
}

export function ArtifactFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [formData, setFormData] = useState<FormData>({
    title: '',
    type: 'scope_document',
    content: '',
  })
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: newArtifact, error } = await supabase
        .from('artifacts')
        .insert({
          project_id: projectId,
          title: data.title,
          type: data.type,
          content: data.content,
          status: 'draft' as ArtifactStatus,
          version: 1,
          created_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'create',
        entity_type: 'artifact',
        entity_id: newArtifact.id,
        entity_name: data.title,
      })

      return newArtifact
    },
    onSuccess: (newArtifact) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'artifacts'] })
      navigate(`/artifacts/${newArtifact.id}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }

    if (!projectId) {
      setError('Project ID is required')
      return
    }

    createMutation.mutate(formData)
  }

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <PageLayout title="New Artifact">
      <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Artifact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      placeholder="e.g., Technical Specification v1"
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleChange('type', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ARTIFACT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => handleChange('content', e.target.value)}
                    placeholder="Write your artifact content here... (Markdown supported)"
                    rows={15}
                    className="w-full px-3 py-2 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Create Artifact
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </PageLayout>
  )
}
