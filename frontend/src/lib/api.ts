import { supabase } from '@/lib/supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function callFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  
  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Request failed')
  }

  return data.data as T
}

// AI Processor
export interface GenerateOptions {
  templateId: string
  context: Record<string, string>
  projectId?: string
  useRag?: boolean
  ragQuery?: string
  saveResult?: boolean
  artifactType?: string
  artifactTitle?: string
}

export interface GenerateResult {
  content: string
  confidence: number
  usage: { inputTokens: number; outputTokens: number }
  ragSources?: string[]
  artifact?: { id: string; status: string }
}

export async function generateContent(options: GenerateOptions): Promise<GenerateResult> {
  return callFunction('ai-processor', {
    action: 'generate',
    ...options,
  })
}

export async function chatWithAI(
  messages: Array<{ role: string; content: string }>,
  options?: { projectId?: string; useRag?: boolean; ragQuery?: string }
): Promise<{ content: string; confidence: number }> {
  return callFunction('ai-processor', {
    action: 'chat',
    messages,
    ...options,
  })
}

export async function listTemplates(): Promise<Array<{
  id: string
  name: string
  description: string
  requiredContext: string[]
}>> {
  return callFunction('ai-processor', {
    action: 'list-templates',
  })
}

// Document Extraction
export async function processDocument(
  artifactId: string,
  forceReprocess?: boolean
): Promise<{ processed: boolean; chunkCount: number }> {
  return callFunction('document-extraction', {
    action: 'process',
    artifactId,
    forceReprocess,
  })
}

// GitHub Integration
export async function connectGitHubRepo(
  projectId: string,
  repoUrl: string
): Promise<{ connected: boolean; repository: { id: number; name: string; url: string } }> {
  return callFunction('github-integration', {
    action: 'connect_repo',
    projectId,
    repoUrl,
  })
}

export async function disconnectGitHubRepo(
  projectId: string
): Promise<{ disconnected: boolean }> {
  return callFunction('github-integration', {
    action: 'disconnect_repo',
    projectId,
  })
}

export async function syncToGitHub(
  ticketId: string
): Promise<{ synced: boolean; created: boolean; issue: { number: number } }> {
  return callFunction('github-integration', {
    action: 'sync_to_github',
    ticketId,
  })
}

export async function syncFromGitHub(
  projectId: string
): Promise<{ synced: boolean; issuesProcessed: number; created: number; updated: number }> {
  return callFunction('github-integration', {
    action: 'sync_from_github',
    projectId,
  })
}

// Staff Actions
export async function approveArtifact(
  signoffId: string,
  comments?: string
): Promise<{ approved: boolean; allApproved: boolean }> {
  return callFunction('staff-actions', {
    action: 'approve_artifact',
    signoffId,
    comments,
  })
}

export async function rejectArtifact(
  signoffId: string,
  comments: string
): Promise<{ rejected: boolean }> {
  return callFunction('staff-actions', {
    action: 'reject_artifact',
    signoffId,
    comments,
  })
}

export async function transitionProject(
  projectId: string,
  targetStatus: string
): Promise<{ transitioned: boolean; previousStatus: string; newStatus: string }> {
  return callFunction('staff-actions', {
    action: 'transition_project',
    projectId,
    targetStatus,
  })
}

export async function createSignoffRequest(
  artifactId: string,
  approverIds: string[],
  dueDate?: string
): Promise<{ created: boolean; signoffCount: number }> {
  return callFunction('staff-actions', {
    action: 'create_signoff_request',
    artifactId,
    approverIds,
    dueDate,
  })
}

// Voice Transcription
export async function transcribeAudio(
  audioUrl: string,
  mimeType?: string
): Promise<{ transcript: string; formattedTranscript: string; duration: number }> {
  return callFunction('voice-transcription', {
    action: 'transcribe',
    audioUrl,
    mimeType,
  })
}

export async function generateMeetingMinutes(
  transcript: string,
  options?: {
    projectId?: string
    meetingTitle?: string
    meetingDate?: string
    attendees?: string[]
    saveAsArtifact?: boolean
  }
): Promise<{ minutes: string; confidence: number; artifact?: { id: string } }> {
  return callFunction('voice-transcription', {
    action: 'generate_minutes',
    transcript,
    ...options,
  })
}

// Blog Generator
export async function generateBlogPost(
  topic: string,
  keyPoints: string[],
  options?: {
    tone?: 'professional' | 'casual' | 'technical' | 'marketing'
    targetAudience?: string
    wordCount?: number
    includeMetadata?: boolean
  }
): Promise<{
  content: string
  wordCount: number
  metadata?: { title: string; description: string; tags: string[] }
}> {
  return callFunction('blog-generator', {
    action: 'generate_blog',
    topic,
    keyPoints,
    ...options,
  })
}

export async function generateProjectUpdate(
  projectId: string,
  tone?: string
): Promise<{
  content: string
  metadata: { title: string; tags: string[] }
  artifact?: { id: string }
}> {
  return callFunction('blog-generator', {
    action: 'generate_update',
    projectId,
    tone,
  })
}
