import { useState } from 'react'
import {
  FileText,
  Download,
  Copy,
  Sparkles,
  Loader2,
  Calendar,
  CheckCircle,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  LoadingState,
  ErrorState,
  Label,
} from '@/components/ui'
import { useProjects, useTickets } from '@/hooks/api'
import { useMutation } from '@tanstack/react-query'
import { generateContent } from '@/lib/api'
import type { Project, Ticket } from '@/types'

type ReportType = 'weekly' | 'monthly' | 'sprint'

export function AutomatedReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [reportType, setReportType] = useState<ReportType>('weekly')
  const [generatedReport, setGeneratedReport] = useState<string>('')
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)
  
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: allTickets, isLoading: ticketsLoading, error } = useTickets()

  // Get selected project data
  const selectedProject = projects?.find((p: Project) => p.id === selectedProjectId)
  const projectTickets = allTickets?.filter((t: Ticket) => 
    selectedProjectId ? t.project_id === selectedProjectId : false
  ) || []

  // Calculate project metrics for context
  const getProjectMetrics = () => {
    const total = projectTickets.length
    const completed = projectTickets.filter((t: Ticket) => t.status === 'done').length
    const inProgress = projectTickets.filter((t: Ticket) => t.status === 'in_progress').length
    const blocked = projectTickets.filter((t: Ticket) => t.status === 'blocked').length
    const open = projectTickets.filter((t: Ticket) => t.status === 'open').length
    
    const totalHours = projectTickets.reduce((sum: number, t: Ticket) => sum + (t.estimated_hours || 0), 0)
    const loggedHours = projectTickets.reduce((sum: number, t: Ticket) => sum + (t.logged_hours || 0), 0)
    
    // Recent completions (last 7 days for weekly, 30 for monthly)
    const days = reportType === 'weekly' ? 7 : reportType === 'monthly' ? 30 : 14
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const recentCompleted = projectTickets.filter((t: Ticket) => 
      t.status === 'done' && t.completed_at && new Date(t.completed_at) >= cutoffDate
    )
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return {
      total,
      completed,
      inProgress,
      blocked,
      open,
      totalHours,
      loggedHours,
      recentCompleted: recentCompleted.length,
      recentCompletedList: recentCompleted.slice(0, 10).map((t: Ticket) => t.title),
      blockedList: projectTickets.filter((t: Ticket) => t.status === 'blocked').map((t: Ticket) => t.title),
      completionRate,
    }
  }

  // Generate report mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const metrics = getProjectMetrics()
      const periodLabel = reportType === 'weekly' ? 'Week' : reportType === 'monthly' ? 'Month' : 'Sprint'
      
      const context = {
        reportType: periodLabel,
        projectName: selectedProject?.name || 'All Projects',
        projectCode: selectedProject?.code || '',
        projectStatus: selectedProject?.status || '',
        startDate: selectedProject?.start_date || '',
        targetEndDate: selectedProject?.target_end_date || '',
        totalTickets: metrics.total.toString(),
        completedTickets: metrics.completed.toString(),
        inProgressTickets: metrics.inProgress.toString(),
        blockedTickets: metrics.blocked.toString(),
        openTickets: metrics.open.toString(),
        completionRate: `${metrics.completionRate}%`,
        totalEstimatedHours: metrics.totalHours.toString(),
        loggedHours: metrics.loggedHours.toString(),
        recentlyCompleted: metrics.recentCompletedList.join(', ') || 'None',
        blockedItems: metrics.blockedList.join(', ') || 'None',
        currentDate: new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
      }
      
      const response = await generateContent({
        templateId: 'project-status-report',
        context,
        projectId: selectedProjectId || undefined,
      })
      
      return response.content
    },
    onSuccess: (content) => {
      setGeneratedReport(content)
    },
  })

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedReport)
    setCopiedToClipboard(true)
    setTimeout(() => setCopiedToClipboard(false), 2000)
  }

  const downloadReport = () => {
    const blob = new Blob([generatedReport], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedProject?.code || 'project'}-${reportType}-report-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = projectsLoading || ticketsLoading

  if (isLoading) {
    return (
      <PageLayout title="Automated Reports">
        <LoadingState message="Loading..." />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Automated Reports">
        <ErrorState message="Failed to load data" />
      </PageLayout>
    )
  }

  const metrics = selectedProjectId ? getProjectMetrics() : null

  return (
    <PageLayout title="Automated Reports">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-lg font-medium">
          <Sparkles className="h-6 w-6 text-primary" />
          <span>AI-Powered Project Reports</span>
        </div>
        <p className="text-muted-foreground mt-1">
          Generate professional status reports automatically using AI
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Configuration
            </CardTitle>
            <CardDescription>
              Select project and report type to generate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Project Selector */}
            <div className="space-y-2">
              <Label>Project *</Label>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value)
                  setGeneratedReport('')
                }}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="">Select a project...</option>
                {projects?.map((p: Project) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            {/* Report Type */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'sprint'] as ReportType[]).map((type) => (
                  <Button
                    key={type}
                    variant={reportType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportType(type)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Project Metrics Preview */}
            {metrics && (
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <h4 className="font-medium text-sm">Project Metrics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tickets:</span>
                    <span className="font-medium">{metrics.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="font-medium text-green-600">{metrics.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">In Progress:</span>
                    <span className="font-medium text-blue-600">{metrics.inProgress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Blocked:</span>
                    <span className="font-medium text-red-600">{metrics.blocked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completion Rate:</span>
                    <span className="font-medium">{metrics.completionRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hours Logged:</span>
                    <span className="font-medium">{metrics.loggedHours}h / {metrics.totalHours}h</span>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!selectedProjectId || generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report
                </>
              )}
            </Button>

            {generateMutation.isError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                Failed to generate report. Please try again.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generated Report Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Report</CardTitle>
              {generatedReport && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    {copiedToClipboard ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadReport}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedReport ? (
              <div className="prose prose-sm max-w-none dark:prose-invert max-h-[600px] overflow-auto">
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg font-mono">
                  {generatedReport}
                </pre>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>Select a project and generate a report</p>
                <p className="text-sm mt-1">AI will create a professional status report</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report Templates Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Available Report Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <h4 className="font-medium">Weekly Report</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Summary of the past 7 days including completed tasks, blockers, and next week's plan.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-purple-500" />
                <h4 className="font-medium">Monthly Report</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Comprehensive monthly overview with metrics, milestones, and trend analysis.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-green-500" />
                <h4 className="font-medium">Sprint Report</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Sprint retrospective with velocity, burndown analysis, and improvement suggestions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
