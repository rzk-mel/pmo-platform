import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project, Artifact, Ticket, Signoff, Inquiry, GitHubSync } from '@/types'

// Query keys
export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  projectArtifacts: (id: string) => ['projects', id, 'artifacts'] as const,
  projectTickets: (id: string) => ['projects', id, 'tickets'] as const,
  projectMembers: (id: string) => ['projects', id, 'members'] as const,
  artifacts: ['artifacts'] as const,
  artifact: (id: string) => ['artifacts', id] as const,
  artifactSignoffs: (id: string) => ['artifacts', id, 'signoffs'] as const,
  signoffs: ['signoffs'] as const,
  mySignoffs: ['signoffs', 'mine'] as const,
  tickets: ['tickets'] as const,
  ticket: (id: string) => ['tickets', id] as const,
  inquiries: ['inquiries'] as const,
  inquiry: (id: string) => ['inquiries', id] as const,
  githubSync: (projectId: string) => ['github-sync', projectId] as const,
  notifications: ['notifications'] as const,
}

// Projects
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_manager:profiles!projects_project_manager_id_fkey(*),
          tech_lead:profiles!projects_tech_lead_id_fkey(*)
        `)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      return data as Project[]
    },
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_manager:profiles!projects_project_manager_id_fkey(*),
          tech_lead:profiles!projects_tech_lead_id_fkey(*),
          client_contact:profiles!projects_client_contact_id_fkey(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Project
    },
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (project: Partial<Project>) => {
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()
      
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data as Project
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(data.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects })
    },
  })
}

// Artifacts
export function useProjectArtifacts(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectArtifacts(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artifacts')
        .select(`
          *,
          creator:profiles!artifacts_created_by_fkey(*)
        `)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Artifact[]
    },
    enabled: !!projectId,
  })
}

export function useArtifact(id: string) {
  return useQuery({
    queryKey: queryKeys.artifact(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artifacts')
        .select(`
          *,
          creator:profiles!artifacts_created_by_fkey(*),
          signoffs(*, assignee:profiles!signoffs_assignee_id_fkey(*))
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Artifact
    },
    enabled: !!id,
  })
}

export function useCreateArtifact() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (artifact: Partial<Artifact>) => {
      const { data, error } = await supabase
        .from('artifacts')
        .insert(artifact)
        .select()
        .single()
      
      if (error) throw error
      return data as Artifact
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectArtifacts(data.project_id) })
    },
  })
}

// Signoffs
export function useMySignoffs() {
  return useQuery({
    queryKey: queryKeys.mySignoffs,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      const { data, error } = await supabase
        .from('signoffs')
        .select(`
          *,
          artifact:artifacts!inner(*, project:projects!inner(*)),
          assignee:profiles!signoffs_assignee_id_fkey(*)
        `)
        .or(`assignee_id.eq.${user.id},delegated_to_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Signoff[]
    },
  })
}

export function useArtifactSignoffs(artifactId: string) {
  return useQuery({
    queryKey: queryKeys.artifactSignoffs(artifactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signoffs')
        .select(`
          *,
          assignee:profiles!signoffs_assignee_id_fkey(*),
          delegated_to:profiles!signoffs_delegated_to_id_fkey(*)
        `)
        .eq('artifact_id', artifactId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data as Signoff[]
    },
    enabled: !!artifactId,
  })
}

// Tickets
export function useProjectTickets(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectTickets(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assignee:profiles!tickets_assignee_id_fkey(*),
          reporter:profiles!tickets_reporter_id_fkey(*)
        `)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Ticket[]
    },
    enabled: !!projectId,
  })
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: queryKeys.ticket(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assignee:profiles!tickets_assignee_id_fkey(*),
          reporter:profiles!tickets_reporter_id_fkey(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Ticket
    },
    enabled: !!id,
  })
}

// Inquiries
export function useProjectInquiries(projectId: string) {
  return useQuery({
    queryKey: ['inquiries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          asker:profiles!inquiries_asked_by_fkey(*),
          answerer:profiles!inquiries_answered_by_fkey(*)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Inquiry[]
    },
    enabled: !!projectId,
  })
}

// GitHub Sync
export function useGitHubSync(projectId: string) {
  return useQuery({
    queryKey: queryKeys.githubSync(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('github_sync')
        .select('*')
        .eq('project_id', projectId)
        .order('last_synced_at', { ascending: false })
      
      if (error) throw error
      return data as GitHubSync[]
    },
    enabled: !!projectId,
  })
}

// Notifications
export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      return data
    },
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    },
  })
}
