// Supabase Edge Function: blog-generator
// Generate blog posts, project updates, and marketing content

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  createHandler,
  jsonResponse,
  requireAuthHeader,
  parseJsonBody,
  validateMethod,
} from '../_shared/response.ts';
import {
  createSupabaseClient,
  createSupabaseAdmin,
  getCurrentUser,
} from '../_shared/supabase.ts';
import { getDashScopeClient, ChatMessage } from '../_shared/gemini.ts';
import { getPromptTemplate, fillPromptTemplate } from '../_shared/prompts.ts';
import {
  ValidationError,
  AuthenticationError,
} from '../_shared/errors.ts';
import { Logger } from '../_shared/logger.ts';

// Request types
interface BlogRequest {
  action: 'generate_blog' | 'generate_update' | 'generate_summary' | 'suggest_topics';
  projectId?: string;
  topic?: string;
  keyPoints?: string[];
  tone?: 'professional' | 'casual' | 'technical' | 'marketing';
  targetAudience?: string;
  wordCount?: number;
  includeMetadata?: boolean;
}

interface BlogMetadata {
  title: string;
  description: string;
  tags: string[];
  readingTime: number;
  seoKeywords: string[];
}

// Calculate reading time (average 200 words per minute)
function calculateReadingTime(text: string): number {
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / 200);
}

// Extract metadata from generated blog post
async function extractMetadata(
  content: string,
  dashscope: ReturnType<typeof getDashScopeClient>,
  logger: Logger
): Promise<BlogMetadata> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Extract metadata from the following blog post and return as JSON:
{
  "title": "suggested title",
  "description": "meta description (150 chars max)",
  "tags": ["tag1", "tag2", "tag3"],
  "seoKeywords": ["keyword1", "keyword2"]
}
Only return valid JSON, nothing else.`,
    },
    {
      role: 'user',
      content: content.slice(0, 2000), // First 2000 chars
    },
  ];

  try {
    const response = await dashscope.chatCompletion(messages, {
      temperature: 0.2,
      maxTokens: 500,
    });

    const parsed = JSON.parse(response.content);
    return {
      title: parsed.title || 'Untitled',
      description: parsed.description || '',
      tags: parsed.tags || [],
      readingTime: calculateReadingTime(content),
      seoKeywords: parsed.seoKeywords || [],
    };
  } catch (error) {
    logger.warn('Failed to extract metadata', { error: String(error) });
    return {
      title: 'Untitled',
      description: '',
      tags: [],
      readingTime: calculateReadingTime(content),
      seoKeywords: [],
    };
  }
}

// Generate project update blog post
async function generateProjectUpdate(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string,
  tone: string,
  logger: Logger
): Promise<{ content: string; metadata: BlogMetadata }> {
  // Fetch project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) {
    throw new ValidationError('Project not found');
  }

  // Fetch recent artifacts
  const { data: artifacts } = await supabase
    .from('artifacts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch recent tickets
  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(10);

  // Calculate progress metrics
  const doneTickets = tickets?.filter(t => t.status === 'done').length || 0;
  const totalTickets = tickets?.length || 0;
  const progressPercentage = totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0;

  const dashscope = getDashScopeClient();

  const context = `
PROJECT: ${project.name}
STATUS: ${project.status}
PROGRESS: ${progressPercentage}% complete (${doneTickets}/${totalTickets} tasks done)
DESCRIPTION: ${project.description || 'No description'}

RECENT MILESTONES:
${artifacts?.map(a => `- ${a.title} (${a.status})`).join('\n') || 'None'}

CURRENT WORK:
${tickets?.filter(t => t.status === 'in_progress').map(t => `- ${t.title}`).join('\n') || 'None'}

COMPLETED RECENTLY:
${tickets?.filter(t => t.status === 'done').slice(0, 5).map(t => `- ${t.title}`).join('\n') || 'None'}
`;

  const toneInstructions: Record<string, string> = {
    professional: 'Use formal, corporate language. Focus on achievements and milestones.',
    casual: 'Use friendly, conversational language. Make it engaging and relatable.',
    technical: 'Include technical details and metrics. Be precise and data-driven.',
    marketing: 'Focus on value delivered and success stories. Use compelling language.',
  };

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are writing a project update blog post. ${toneInstructions[tone] || toneInstructions.professional}
      
Write in markdown format with:
- An engaging title
- Brief introduction
- Key highlights/achievements
- Current status and progress
- What's coming next
- Call to action or closing

Keep it concise but informative. Around 400-600 words.`,
    },
    {
      role: 'user',
      content: `Generate a project update blog post based on:\n${context}`,
    },
  ];

  logger.info('Generating project update', { projectId, tone });

  const response = await dashscope.chatCompletion(messages, {
    temperature: 0.6,
    maxTokens: 2000,
  });

  const metadata = await extractMetadata(response.content, dashscope, logger);

  return {
    content: response.content,
    metadata,
  };
}

// Suggest blog topics based on project context
async function suggestTopics(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string | undefined,
  logger: Logger
): Promise<Array<{ topic: string; description: string; type: string }>> {
  const dashscope = getDashScopeClient();
  let context = '';

  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (project) {
      context = `
PROJECT: ${project.name}
STATUS: ${project.status}
DESCRIPTION: ${project.description || 'Software project'}
`;
    }
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Suggest 5 blog post topics for a PMO/project management platform. Return as JSON array:
[
  {
    "topic": "Blog post title",
    "description": "Brief description of what the post would cover",
    "type": "update|technical|tutorial|case-study|announcement"
  }
]
Only return valid JSON.`,
    },
    {
      role: 'user',
      content: context || 'Suggest general PMO/project management blog topics.',
    },
  ];

  const response = await dashscope.chatCompletion(messages, {
    temperature: 0.8,
    maxTokens: 1000,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    logger.warn('Failed to parse topic suggestions');
    return [
      {
        topic: 'Project Management Best Practices',
        description: 'Essential tips for successful project delivery',
        type: 'tutorial',
      },
    ];
  }
}

// Main handler
const handler = createHandler(async (req: Request, logger: Logger, requestId: string) => {
  validateMethod(req, ['POST']);

  const authHeader = requireAuthHeader(req);
  const supabase = createSupabaseClient(authHeader);
  const adminClient = createSupabaseAdmin();

  // Authenticate user
  const user = await getCurrentUser(supabase);
  if (!user) {
    throw new AuthenticationError();
  }

  logger.setUserId(user.id);

  const body = await parseJsonBody<BlogRequest>(req);
  const dashscope = getDashScopeClient();

  switch (body.action) {
    case 'generate_blog': {
      if (!body.topic || !body.keyPoints || body.keyPoints.length === 0) {
        throw new ValidationError('topic and keyPoints are required');
      }

      const template = getPromptTemplate('blog-post');
      if (!template) {
        throw new ValidationError('Blog post template not found');
      }

      const context = {
        topic: body.topic,
        audience: body.targetAudience || 'software professionals',
        keyPoints: body.keyPoints.map(p => `- ${p}`).join('\n'),
        tone: body.tone || 'professional',
        length: String(body.wordCount || 600),
      };

      const { systemPrompt, userPrompt } = fillPromptTemplate(template, context);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      logger.info('Generating blog post', { topic: body.topic });

      const response = await dashscope.chatCompletion(messages, {
        temperature: template.temperature,
        maxTokens: template.maxTokens,
      });

      let metadata: BlogMetadata | undefined;
      if (body.includeMetadata) {
        metadata = await extractMetadata(response.content, dashscope, logger);
      }

      return jsonResponse({
        content: response.content,
        wordCount: response.content.split(/\s+/).length,
        metadata,
      }, 200, requestId);
    }

    case 'generate_update': {
      if (!body.projectId) {
        throw new ValidationError('projectId is required for update generation');
      }

      logger.setProjectId(body.projectId);

      const result = await generateProjectUpdate(
        supabase,
        body.projectId,
        body.tone || 'professional',
        logger
      );

      // Optionally save as internal artifact
      const { data: artifact } = await adminClient
        .from('internal_artifacts')
        .insert({
          org_id: (await supabase.from('projects').select('org_id').eq('id', body.projectId).single()).data?.org_id,
          project_id: body.projectId,
          title: result.metadata.title,
          content: result.content,
          category: 'blog_draft',
          tags: result.metadata.tags,
          created_by: user.id,
        })
        .select()
        .single();

      return jsonResponse({
        content: result.content,
        metadata: result.metadata,
        artifact: artifact ? { id: artifact.id } : null,
      }, 200, requestId);
    }

    case 'generate_summary': {
      if (!body.projectId) {
        throw new ValidationError('projectId is required for summary generation');
      }

      logger.setProjectId(body.projectId);

      // Fetch project data
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', body.projectId)
        .single();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'Generate a brief executive summary (2-3 paragraphs) of the project status suitable for stakeholder communication.',
        },
        {
          role: 'user',
          content: `Project: ${project.name}\nStatus: ${project.status}\nDescription: ${project.description || 'N/A'}`,
        },
      ];

      const response = await dashscope.chatCompletion(messages, {
        temperature: 0.4,
        maxTokens: 500,
      });

      return jsonResponse({
        summary: response.content,
        projectName: project.name,
        projectStatus: project.status,
      }, 200, requestId);
    }

    case 'suggest_topics': {
      const topics = await suggestTopics(supabase, body.projectId, logger);

      return jsonResponse({
        topics,
        count: topics.length,
      }, 200, requestId);
    }

    default:
      throw new ValidationError(`Unknown action: ${body.action}`);
  }
}, 'blog-generator');

serve(handler);
