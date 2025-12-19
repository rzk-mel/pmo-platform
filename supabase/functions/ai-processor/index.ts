// Supabase Edge Function: ai-processor
// Handles AI generation requests with RAG support and guardrails

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
  getCurrentUser,
  getUserProfile,
} from '../_shared/supabase.ts';
import {
  getDashScopeClient,
  ChatMessage,
} from '../_shared/gemini.ts';
import {
  getPromptTemplate,
  fillPromptTemplate,
  listPromptTemplates,
} from '../_shared/prompts.ts';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
} from '../_shared/errors.ts';
import { Logger } from '../_shared/logger.ts';

// Request types
interface GenerateRequest {
  action: 'generate' | 'chat' | 'embed' | 'list-templates';
  templateId?: string;
  context?: Record<string, string>;
  messages?: ChatMessage[];
  text?: string;
  projectId?: string;
  useRag?: boolean;
  ragQuery?: string;
  saveResult?: boolean;
  artifactType?: string;
  artifactTitle?: string;
}

interface RagContext {
  chunks: Array<{
    text: string;
    source: string;
    similarity: number;
  }>;
  query: string;
}

// RAG search helper
async function searchDocuments(
  supabase: ReturnType<typeof createSupabaseClient>,
  query: string,
  projectId: string | null,
  logger: Logger
): Promise<RagContext> {
  const dashscope = getDashScopeClient();
  
  logger.info('Generating query embedding');
  const { embedding } = await dashscope.generateEmbedding(query);

  logger.info('Searching documents with pgvector');
  const { data, error } = await supabase.rpc('search_documents', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5,
    p_project_id: projectId,
  });

  if (error) {
    logger.warn('Document search failed', { error: error.message });
    return { chunks: [], query };
  }

  return {
    query,
    chunks: (data || []).map((d: { chunk_text: string; source_type: string; source_id: string; similarity: number }) => ({
      text: d.chunk_text,
      source: `${d.source_type}:${d.source_id}`,
      similarity: d.similarity,
    })),
  };
}

// Format RAG context for prompt
function formatRagContext(ragContext: RagContext): string {
  if (ragContext.chunks.length === 0) {
    return 'No relevant documents found.';
  }

  return ragContext.chunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.source}]\n${chunk.text}`)
    .join('\n\n---\n\n');
}

// Confidence score calculation
function calculateConfidence(
  response: string,
  ragContext?: RagContext
): number {
  let score = 0.8; // Base confidence

  // Check for uncertainty markers
  const uncertaintyMarkers = [
    'I cannot find',
    'I don\'t have',
    'not available',
    'unclear',
    '[ASSUMPTION]',
    '[REQUIRES_INPUT]',
  ];

  for (const marker of uncertaintyMarkers) {
    if (response.includes(marker)) {
      score -= 0.1;
    }
  }

  // Boost for RAG context usage
  if (ragContext && ragContext.chunks.length > 0) {
    const avgSimilarity = ragContext.chunks.reduce((a, b) => a + b.similarity, 0) / ragContext.chunks.length;
    score = Math.min(score + (avgSimilarity * 0.2), 1.0);
  }

  return Math.max(0.1, Math.min(1.0, score));
}

// Save generated content as artifact
async function saveAsArtifact(
  supabase: ReturnType<typeof createSupabaseClient>,
  content: string,
  projectId: string,
  type: string,
  title: string,
  confidence: number,
  promptUsed: string,
  userId: string,
  logger: Logger
) {
  logger.info('Saving generated content as artifact', { projectId, type });

  const { data, error } = await supabase
    .from('artifacts')
    .insert({
      project_id: projectId,
      type: type as 'scope_document' | 'sow' | 'technical_spec' | 'meeting_minutes' | 'poc_report' | 'test_plan' | 'uat_report' | 'sign_off_document' | 'risk_assessment' | 'other',
      title,
      content,
      status: 'draft', // Always draft for AI content
      ai_generated: true,
      ai_confidence: confidence,
      ai_prompt_used: promptUsed,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to save artifact', error as Error);
    throw error;
  }

  return data;
}

// Main handler
const handler = createHandler(async (req: Request, logger: Logger, requestId: string) => {
  validateMethod(req, ['POST', 'GET']);

  const authHeader = requireAuthHeader(req);
  const supabase = createSupabaseClient(authHeader);

  // Authenticate user
  const user = await getCurrentUser(supabase);
  if (!user) {
    throw new AuthenticationError();
  }

  logger.setUserId(user.id);

  // GET = list templates
  if (req.method === 'GET') {
    return jsonResponse(listPromptTemplates(), 200, requestId);
  }

  // POST = generate content
  const body = await parseJsonBody<GenerateRequest>(req);
  const dashscope = getDashScopeClient();

  // Handle different actions
  switch (body.action) {
    case 'list-templates': {
      return jsonResponse(listPromptTemplates(), 200, requestId);
    }

    case 'embed': {
      // Generate embedding for text
      if (!body.text) {
        throw new ValidationError('text is required for embed action');
      }

      const result = await dashscope.generateEmbedding(body.text);
      return jsonResponse({
        embedding: result.embedding,
        dimensions: result.embedding.length,
        usage: result.usage,
      }, 200, requestId);
    }

    case 'chat': {
      // Direct chat without template
      if (!body.messages || body.messages.length === 0) {
        throw new ValidationError('messages are required for chat action');
      }

      // Get RAG context if enabled
      let ragContext: RagContext | undefined;
      if (body.useRag && body.ragQuery) {
        ragContext = await searchDocuments(
          supabase,
          body.ragQuery,
          body.projectId || null,
          logger
        );

        // Inject RAG context into system message
        const contextMessage: ChatMessage = {
          role: 'system',
          content: `Use the following context to answer questions:\n\n${formatRagContext(ragContext)}`,
        };
        body.messages = [contextMessage, ...body.messages];
      }

      const response = await dashscope.chatCompletion(body.messages, {
        temperature: 0.5,
        maxTokens: 2000,
      });

      const confidence = calculateConfidence(response.content, ragContext);

      return jsonResponse({
        content: response.content,
        confidence,
        usage: response.usage,
        ragSources: ragContext?.chunks.map(c => c.source),
      }, 200, requestId);
    }

    case 'generate': {
      // Template-based generation
      if (!body.templateId) {
        throw new ValidationError('templateId is required for generate action');
      }

      const template = getPromptTemplate(body.templateId);
      if (!template) {
        throw new ValidationError(`Template '${body.templateId}' not found`);
      }

      const context = body.context || {};

      // Add project context if available
      if (body.projectId) {
        logger.setProjectId(body.projectId);
        
        const { data: project } = await supabase
          .from('projects')
          .select('*')
          .eq('id', body.projectId)
          .single();

        if (project) {
          context.projectName = context.projectName || project.name;
          context.projectDescription = context.projectDescription || project.description || '';
        }
      }

      // Get RAG context if enabled
      let ragContext: RagContext | undefined;
      if (body.useRag) {
        const ragQuery = body.ragQuery || context.projectName || body.templateId;
        ragContext = await searchDocuments(
          supabase,
          ragQuery,
          body.projectId || null,
          logger
        );
        context.additionalContext = (context.additionalContext || '') + '\n\n' + formatRagContext(ragContext);
      }

      // Fill template
      const { systemPrompt, userPrompt } = fillPromptTemplate(template, context);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      logger.info('Generating content with template', {
        templateId: body.templateId,
        temperature: template.temperature,
      });

      const response = await dashscope.chatCompletion(messages, {
        temperature: template.temperature,
        maxTokens: template.maxTokens,
      });

      const confidence = calculateConfidence(response.content, ragContext);

      // Validate JSON output if expected
      let parsedContent = response.content;
      if (template.outputFormat === 'json') {
        try {
          parsedContent = JSON.parse(response.content);
        } catch {
          logger.warn('Failed to parse JSON output, returning raw');
        }
      }

      // Save as artifact if requested
      let artifact = null;
      if (body.saveResult && body.projectId) {
        // Check user has permission to create artifacts
        const profile = await getUserProfile(supabase, user.id);
        if (!profile || ['viewer', 'client_stakeholder'].includes(profile.role)) {
          throw new AuthorizationError('Cannot create artifacts');
        }

        artifact = await saveAsArtifact(
          supabase,
          typeof parsedContent === 'string' ? parsedContent : JSON.stringify(parsedContent, null, 2),
          body.projectId,
          body.artifactType || 'other',
          body.artifactTitle || `AI Generated: ${template.name}`,
          confidence,
          userPrompt,
          user.id,
          logger
        );
      }

      return jsonResponse({
        content: parsedContent,
        confidence,
        usage: response.usage,
        templateUsed: body.templateId,
        ragSources: ragContext?.chunks.map(c => c.source),
        artifact: artifact ? { id: artifact.id, status: artifact.status } : null,
      }, 200, requestId);
    }

    default:
      throw new ValidationError(`Unknown action: ${body.action}`);
  }
}, 'ai-processor');

serve(handler);
