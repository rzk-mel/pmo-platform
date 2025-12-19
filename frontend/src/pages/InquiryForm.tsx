import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { PageLayout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Project } from '@/types'

export function InquiryFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [formData, setFormData] = useState({
    subject: '',
    body: '',
    project_id: '',
    is_internal: false,
  })
  const [error, setError] = useState<string | null>(null)

  // Fetch projects for selection
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, code, name')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return data as Pick<Project, 'id' | 'code' | 'name'>[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: newInquiry, error } = await supabase
        .from('inquiries')
        .insert({
          subject: formData.subject,
          body: formData.body,
          project_id: formData.project_id || null,
          is_internal: formData.is_internal,
          asked_by: user?.id,
          status: 'open',
        })
        .select()
        .single()

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'create',
        entity_type: 'inquiry',
        entity_id: newInquiry.id,
        entity_name: formData.subject,
      })

      return newInquiry
    },
    onSuccess: (newInquiry) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      navigate(`/inquiries/${newInquiry.id}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.subject.trim() || !formData.body.trim()) {
      setError('Subject and question are required')
      return
    }

    createMutation.mutate()
  }

  return (
    <PageLayout title="New Inquiry">
      <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ask a Question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject *</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="e.g., How should we handle authentication?"
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Question *</label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Describe your question in detail..."
                    rows={8}
                    className="w-full px-3 py-2 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Related Project (optional)</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">No specific project</option>
                    {projects?.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_internal"
                    checked={formData.is_internal}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_internal: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="is_internal" className="text-sm">
                    Internal question (only visible to team members)
                  </label>
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
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit Inquiry
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
