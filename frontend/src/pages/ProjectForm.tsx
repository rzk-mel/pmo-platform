import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { PageLayout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/states'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Project, ProjectStatus, Profile } from '@/types'

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scoping', label: 'Scoping' },
  { value: 'sow_draft', label: 'SOW Draft' },
  { value: 'sow_review', label: 'SOW Review' },
  { value: 'poc_phase', label: 'POC Phase' },
  { value: 'development', label: 'Development' },
  { value: 'uat_phase', label: 'UAT Phase' },
  { value: 'sign_off', label: 'Sign Off' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface ProjectFormData {
  code: string
  name: string
  description: string
  status: ProjectStatus
  start_date: string
  target_end_date: string
  estimated_budget: string
  currency: string
  project_manager_id: string
  tech_lead_id: string
}

const initialFormData: ProjectFormData = {
  code: '',
  name: '',
  description: '',
  status: 'draft',
  start_date: '',
  target_end_date: '',
  estimated_budget: '',
  currency: 'IDR',
  project_manager_id: '',
  tech_lead_id: '',
}

export function ProjectFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isEdit = !!id

  const [formData, setFormData] = useState<ProjectFormData>(initialFormData)
  const [error, setError] = useState<string | null>(null)

  // Fetch team members for assignment
  const { data: teamMembers } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return data as Profile[]
    },
  })

  // Fetch existing project for edit
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Project
    },
    enabled: isEdit,
  })

  // Populate form when editing
  useEffect(() => {
    if (project) {
      setFormData({
        code: project.code,
        name: project.name,
        description: project.description || '',
        status: project.status,
        start_date: project.start_date || '',
        target_end_date: project.target_end_date || '',
        estimated_budget: project.estimated_budget?.toString() || '',
        currency: project.currency || 'IDR',
        project_manager_id: project.project_manager_id || '',
        tech_lead_id: project.tech_lead_id || '',
      })
    }
  }, [project])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          code: data.code,
          name: data.name,
          description: data.description || null,
          status: data.status,
          start_date: data.start_date || null,
          target_end_date: data.target_end_date || null,
          estimated_budget: data.estimated_budget ? parseFloat(data.estimated_budget) : null,
          currency: data.currency,
          project_manager_id: data.project_manager_id || null,
          tech_lead_id: data.tech_lead_id || null,
          org_id: user?.org_id,
          created_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'create',
        entity_type: 'project',
        entity_id: newProject.id,
        entity_name: data.name,
        new_values: data,
      })

      return newProject
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/projects/${newProject.id}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const oldValues = {
        code: project?.code,
        name: project?.name,
        description: project?.description,
        status: project?.status,
      }

      const { error } = await supabase
        .from('projects')
        .update({
          code: data.code,
          name: data.name,
          description: data.description || null,
          status: data.status,
          start_date: data.start_date || null,
          target_end_date: data.target_end_date || null,
          estimated_budget: data.estimated_budget ? parseFloat(data.estimated_budget) : null,
          currency: data.currency,
          project_manager_id: data.project_manager_id || null,
          tech_lead_id: data.tech_lead_id || null,
        })
        .eq('id', id)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'update',
        entity_type: 'project',
        entity_id: id,
        entity_name: data.name,
        old_values: oldValues,
        new_values: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      navigate(`/projects/${id}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Code and Name are required')
      return
    }

    if (isEdit) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  if (isEdit && isLoading) {
    return (
      <PageLayout title="Edit Project">
        <LoadingState message="Loading project..." />
      </PageLayout>
    )
  }

  return (
    <PageLayout title={isEdit ? 'Edit Project' : 'New Project'}>
      <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Code *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => handleChange('code', e.target.value)}
                      placeholder="e.g., PMO-2024-001"
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {PROJECT_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter project name"
                    className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Project description..."
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Manager</label>
                    <select
                      value={formData.project_manager_id}
                      onChange={(e) => handleChange('project_manager_id', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers?.filter(m => ['project_manager', 'org_admin', 'super_admin'].includes(m.role)).map(member => (
                        <option key={member.id} value={member.id}>{member.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tech Lead</label>
                    <select
                      value={formData.tech_lead_id}
                      onChange={(e) => handleChange('tech_lead_id', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers?.filter(m => ['tech_lead', 'org_admin', 'super_admin'].includes(m.role)).map(member => (
                        <option key={member.id} value={member.id}>{member.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline & Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => handleChange('start_date', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target End Date</label>
                    <input
                      type="date"
                      value={formData.target_end_date}
                      onChange={(e) => handleChange('target_end_date', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estimated Budget</label>
                    <input
                      type="number"
                      value={formData.estimated_budget}
                      onChange={(e) => handleChange('estimated_budget', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="IDR">IDR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar with actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isEdit ? 'Update Project' : 'Create Project'}
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
