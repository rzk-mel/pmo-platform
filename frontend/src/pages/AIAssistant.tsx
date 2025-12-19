import { useState } from 'react'
import {
  Sparkles,
  FileText,
  MessageSquare,
  Mic,
  PenTool,
  Loader2,
  Copy,
  AlertCircle,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Label,
} from '@/components/ui'
import { useProjects } from '@/hooks/api'
import {
  generateContent,
  chatWithAI,
  listTemplates,
  generateMeetingMinutes,
  generateBlogPost,
} from '@/lib/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

// Document Generator Tab
function DocumentGeneratorTab() {
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ content: string; confidence: number } | null>(null)
  const [saveAsArtifact, setSaveAsArtifact] = useState(true)
  const [artifactTitle, setArtifactTitle] = useState('')

  const { data: projects } = useProjects()
  const { data: templates } = useQuery({
    queryKey: ['ai-templates'],
    queryFn: listTemplates,
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await generateContent({
        templateId: selectedTemplate,
        context: formData,
        projectId: projectId || undefined,
        saveResult: saveAsArtifact,
        artifactTitle: artifactTitle || undefined,
        artifactType: selectedTemplate.includes('sow') ? 'sow' : 
                      selectedTemplate.includes('tech') ? 'technical_spec' : 
                      selectedTemplate.includes('risk') ? 'risk_assessment' : 'other',
      })
      return res
    },
    onSuccess: (data) => {
      setResult({ content: data.content, confidence: data.confidence })
    },
  })

  const selectedTemplateDetails = templates?.find(t => t.id === selectedTemplate)

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const copyToClipboard = () => {
    if (result?.content) {
      navigator.clipboard.writeText(result.content)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Document
            </CardTitle>
            <CardDescription>
              Select a template and fill in the required fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template Selector */}
            <div className="space-y-2">
              <Label>Template</Label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value)
                  setFormData({})
                  setResult(null)
                }}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="">Select a template...</option>
                {templates?.filter(t => 
                  ['sow-generation', 'tech-spec-generation', 'risk-assessment', 'email-draft'].includes(t.id)
                ).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Project Selector */}
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value)
                  const proj = projects?.find((p: Project) => p.id === e.target.value)
                  if (proj) {
                    setFormData(prev => ({
                      ...prev,
                      projectName: proj.name,
                      projectDescription: proj.description || '',
                    }))
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="">None - manual input</option>
                {projects?.map((p: Project) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Fields based on template */}
            {selectedTemplateDetails?.requiredContext.map(field => (
              <div key={field} className="space-y-2">
                <Label className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</Label>
                {field.includes('Summary') || field.includes('Description') || field.includes('deliverables') || field.includes('requirements') ? (
                  <textarea
                    value={formData[field] || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={`Enter ${field}...`}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
                  />
                ) : (
                  <Input
                    value={formData[field] || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={`Enter ${field}...`}
                  />
                )}
              </div>
            ))}

            {/* Save Options */}
            {selectedTemplate && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveArtifact"
                    checked={saveAsArtifact}
                    onChange={(e) => setSaveAsArtifact(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="saveArtifact">Save as artifact</Label>
                </div>
                {saveAsArtifact && (
                  <Input
                    value={artifactTitle}
                    onChange={(e) => setArtifactTitle(e.target.value)}
                    placeholder="Artifact title (optional)"
                  />
                )}
              </div>
            )}

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!selectedTemplate || generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Document
                </>
              )}
            </Button>

            {generateMutation.isError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {(generateMutation.error as Error).message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Content</CardTitle>
              {result && (
                <div className="flex items-center gap-2">
                  <Badge variant={result.confidence > 0.7 ? 'success' : result.confidence > 0.5 ? 'warning' : 'destructive'}>
                    {Math.round(result.confidence * 100)}% confidence
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="prose prose-sm max-w-none dark:prose-invert max-h-[500px] overflow-auto">
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                  {result.content}
                </pre>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>Generated content will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Chat Assistant Tab
function ChatAssistantTab() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const [projectId, setProjectId] = useState('')
  const [useRag, setUseRag] = useState(true)

  const { data: projects } = useProjects()

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const allMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage },
      ]
      return chatWithAI(allMessages, {
        projectId: projectId || undefined,
        useRag,
        ragQuery: userMessage,
      })
    },
    onSuccess: (data, userMessage) => {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: data.content },
      ])
      setInput('')
    },
  })

  const handleSend = () => {
    if (input.trim() && !chatMutation.isPending) {
      chatMutation.mutate(input.trim())
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Chat Area */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Chat Assistant
          </CardTitle>
          <CardDescription>
            Ask questions about your projects. AI uses project documents for context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages */}
          <div className="h-[400px] overflow-auto space-y-4 p-4 bg-muted/30 rounded-lg">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Start a conversation with the AI assistant</p>
                  <p className="text-sm">Try asking about project scope, timelines, or technical requirements</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded-lg max-w-[80%]",
                    msg.role === 'user'
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-card border"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
            {chatMutation.isPending && (
              <div className="p-3 rounded-lg bg-card border max-w-[80%]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={chatMutation.isPending}
            />
            <Button onClick={handleSend} disabled={!input.trim() || chatMutation.isPending}>
              Send
            </Button>
          </div>

          {chatMutation.isError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {(chatMutation.error as Error).message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Chat Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Project Context</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background"
            >
              <option value="">All projects</option>
              {projects?.map((p: Project) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Select a project to focus AI responses on that project's documents
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useRag"
              checked={useRag}
              onChange={(e) => setUseRag(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="useRag">Use document search (RAG)</Label>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setMessages([])}
          >
            Clear Chat
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// Meeting Transcription Tab
function MeetingTranscriptionTab() {
  const [transcript, setTranscript] = useState('')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [attendees, setAttendees] = useState('')
  const [projectId, setProjectId] = useState('')
  const [result, setResult] = useState<{ minutes: string; confidence: number } | null>(null)

  const { data: projects } = useProjects()

  const generateMutation = useMutation({
    mutationFn: async () => {
      return generateMeetingMinutes(transcript, {
        projectId: projectId || undefined,
        meetingTitle: meetingTitle || undefined,
        meetingDate: meetingDate || undefined,
        attendees: attendees ? attendees.split(',').map(a => a.trim()) : undefined,
        saveAsArtifact: true,
      })
    },
    onSuccess: (data) => {
      setResult({ minutes: data.minutes, confidence: data.confidence })
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Meeting Transcription
          </CardTitle>
          <CardDescription>
            Paste a meeting transcript to generate structured meeting minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Meeting Title</Label>
            <Input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Weekly Standup, Client Review, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="">None</option>
                {projects?.map((p: Project) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attendees (comma-separated)</Label>
            <Input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="John Doe, Jane Smith, ..."
            />
          </div>

          <div className="space-y-2">
            <Label>Transcript *</Label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your meeting transcript here..."
              rows={10}
              className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
            />
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!transcript.trim() || generateMutation.isPending}
            className="w-full"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Minutes...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Meeting Minutes
              </>
            )}
          </Button>

          {generateMutation.isError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {(generateMutation.error as Error).message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Meeting Minutes</CardTitle>
            {result && (
              <Badge variant={result.confidence > 0.7 ? 'success' : 'warning'}>
                {Math.round(result.confidence * 100)}% confidence
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="prose prose-sm max-w-none dark:prose-invert max-h-[500px] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                {result.minutes}
              </pre>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <p>Generated minutes will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Blog Generator Tab
function BlogGeneratorTab() {
  const [topic, setTopic] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [tone, setTone] = useState<'professional' | 'casual' | 'technical' | 'marketing'>('professional')
  const [wordCount, setWordCount] = useState(500)
  const [result, setResult] = useState<{ content: string; wordCount: number } | null>(null)

  const generateMutation = useMutation({
    mutationFn: async () => {
      return generateBlogPost(topic, keyPoints.split('\n').filter(k => k.trim()), {
        tone,
        wordCount,
        includeMetadata: true,
      })
    },
    onSuccess: (data) => {
      setResult({ content: data.content, wordCount: data.wordCount })
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            Blog Post Generator
          </CardTitle>
          <CardDescription>
            Generate blog posts or project updates for stakeholders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Topic *</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Launching our new e-commerce platform"
            />
          </div>

          <div className="space-y-2">
            <Label>Key Points (one per line) *</Label>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              placeholder="Modern tech stack with React&#10;Mobile-first design&#10;Faster checkout experience"
              rows={5}
              className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as typeof tone)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="technical">Technical</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Word Count (~{wordCount})</Label>
              <input
                type="range"
                min={200}
                max={1500}
                step={100}
                value={wordCount}
                onChange={(e) => setWordCount(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!topic.trim() || !keyPoints.trim() || generateMutation.isPending}
            className="w-full"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Blog Post
              </>
            )}
          </Button>

          {generateMutation.isError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {(generateMutation.error as Error).message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Generated Blog Post</CardTitle>
            {result && (
              <Badge variant="secondary">
                {result.wordCount} words
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="prose prose-sm max-w-none dark:prose-invert max-h-[500px] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                {result.content}
              </pre>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <p>Generated blog post will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Main AI Assistant Page
export function AIAssistantPage() {
  return (
    <PageLayout title="AI Assistant">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-lg font-medium">
          <Sparkles className="h-6 w-6 text-primary" />
          <span>Powered by Google Gemini</span>
        </div>
        <p className="text-muted-foreground mt-1">
          Generate documents, chat with AI, transcribe meetings, and create blog posts
        </p>
      </div>

      <Tabs defaultValue="document" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="document" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="meeting" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Meeting</span>
          </TabsTrigger>
          <TabsTrigger value="blog" className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            <span className="hidden sm:inline">Blog</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="document">
          <DocumentGeneratorTab />
        </TabsContent>

        <TabsContent value="chat">
          <ChatAssistantTab />
        </TabsContent>

        <TabsContent value="meeting">
          <MeetingTranscriptionTab />
        </TabsContent>

        <TabsContent value="blog">
          <BlogGeneratorTab />
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
