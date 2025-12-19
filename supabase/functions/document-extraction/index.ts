// Supabase Edge Function: document-extraction
// Extract text from uploaded documents and generate embeddings

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
import { getDashScopeClient } from '../_shared/dashscope.ts';
import {
  ValidationError,
  AuthenticationError,
  ExternalServiceError,
} from '../_shared/errors.ts';
import { Logger } from '../_shared/logger.ts';

// Request types
interface ExtractRequest {
  action: 'extract' | 'embed' | 'process';
  artifactId?: string;
  internalArtifactId?: string;
  filePath?: string;
  content?: string;
  mimeType?: string;
  forceReprocess?: boolean;
}

// Chunk configuration
const CHUNK_SIZE = 500; // tokens (approximate)
const CHUNK_OVERLAP = 50; // tokens

// Simple text chunker (semantic chunking would need more sophisticated logic)
function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  
  // Approximate tokens by words (rough estimate: 1 token ≈ 0.75 words)
  const words = text.split(/\s+/);
  const wordsPerChunk = Math.floor(chunkSize * 0.75);
  const overlapWords = Math.floor(overlap * 0.75);

  for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

// Extract text from different file types
async function extractTextFromFile(
  supabase: ReturnType<typeof createSupabaseClient>,
  filePath: string,
  mimeType: string,
  logger: Logger
): Promise<string> {
  logger.info('Extracting text from file', { filePath, mimeType });

  // Download file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(filePath);

  if (downloadError || !fileData) {
    throw new ExternalServiceError('Storage', 'Failed to download file');
  }

  // Handle different MIME types
  switch (mimeType) {
    case 'text/plain':
    case 'text/markdown':
    case 'application/json': {
      return await fileData.text();
    }

    case 'application/pdf': {
      // For PDF extraction, we'd typically use a library
      // In Deno Edge Functions, we can call an external service or use DashScope vision
      // For now, return a placeholder - in production, integrate with pdf-parse or similar
      logger.warn('PDF extraction requires external service integration');
      const text = await fileData.text();
      // Basic text extraction attempt
      return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      // For DOCX, similar situation - need mammoth or similar
      logger.warn('DOCX extraction requires external service integration');
      const text = await fileData.text();
      return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
    }

    case 'image/png':
    case 'image/jpeg':
    case 'image/webp': {
      // Use DashScope Vision for OCR
      logger.info('Using DashScope Vision for image OCR');
      const base64 = btoa(
        new Uint8Array(await fileData.arrayBuffer()).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const dashscope = getDashScopeClient();
      const response = await dashscope.chatCompletion([
        {
          role: 'user',
          content: `Extract all text from this image. Return only the extracted text, nothing else. Image data: data:${mimeType};base64,${base64}`,
        },
      ], {
        model: 'qwen-vl-plus' as 'qwen-plus', // Vision model
        maxTokens: 4000,
      });

      return response.content;
    }

    default:
      throw new ValidationError(`Unsupported file type: ${mimeType}`);
  }
}

// Generate and store embeddings for text chunks
async function generateAndStoreEmbeddings(
  adminClient: ReturnType<typeof createSupabaseAdmin>,
  chunks: string[],
  sourceType: 'artifact' | 'internal_artifact' | 'conversation',
  sourceId: string,
  metadata: Record<string, unknown>,
  logger: Logger
): Promise<number> {
  const dashscope = getDashScopeClient();

  logger.info('Generating embeddings', { chunkCount: chunks.length, sourceType, sourceId });

  // Delete existing embeddings for this source
  const columnMap = {
    artifact: 'artifact_id',
    internal_artifact: 'internal_artifact_id',
    conversation: 'conversation_id',
  };

  await adminClient
    .from('document_embeddings')
    .delete()
    .eq(columnMap[sourceType], sourceId);

  // Generate embeddings in batches
  const batchSize = 10;
  let insertedCount = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    const embeddings = await dashscope.generateEmbeddings(batch);

    const rows = batch.map((chunk, idx) => ({
      [columnMap[sourceType]]: sourceId,
      chunk_index: i + idx,
      chunk_text: chunk,
      embedding: embeddings[idx].embedding,
      metadata: {
        ...metadata,
        chunk_index: i + idx,
        total_chunks: chunks.length,
      },
    }));

    const { error } = await adminClient
      .from('document_embeddings')
      .insert(rows);

    if (error) {
      logger.error('Failed to insert embeddings', error as Error);
      throw error;
    }

    insertedCount += rows.length;
    logger.debug('Inserted embedding batch', { batch: i, count: rows.length });
  }

  return insertedCount;
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

  const body = await parseJsonBody<ExtractRequest>(req);

  switch (body.action) {
    case 'extract': {
      // Extract text from file
      if (!body.filePath || !body.mimeType) {
        throw new ValidationError('filePath and mimeType are required for extract action');
      }

      const text = await extractTextFromFile(supabase, body.filePath, body.mimeType, logger);
      const chunks = chunkText(text);

      return jsonResponse({
        text,
        chunks,
        chunkCount: chunks.length,
        characterCount: text.length,
      }, 200, requestId);
    }

    case 'embed': {
      // Generate embeddings from provided content
      if (!body.content) {
        throw new ValidationError('content is required for embed action');
      }

      const chunks = chunkText(body.content);
      const dashscope = getDashScopeClient();
      const embeddings = await dashscope.generateEmbeddings(chunks);

      return jsonResponse({
        chunkCount: chunks.length,
        embeddingDimensions: embeddings[0]?.embedding.length || 0,
        totalTokens: embeddings.reduce((sum, e) => sum + e.usage.totalTokens, 0),
      }, 200, requestId);
    }

    case 'process': {
      // Full processing: extract, chunk, embed, and store
      if (!body.artifactId && !body.internalArtifactId) {
        throw new ValidationError('artifactId or internalArtifactId is required for process action');
      }

      let text: string;
      let sourceType: 'artifact' | 'internal_artifact';
      let sourceId: string;
      let metadata: Record<string, unknown> = {};

      if (body.artifactId) {
        sourceType = 'artifact';
        sourceId = body.artifactId;

        // Fetch artifact
        const { data: artifact, error } = await supabase
          .from('artifacts')
          .select('*')
          .eq('id', body.artifactId)
          .single();

        if (error || !artifact) {
          throw new ValidationError('Artifact not found');
        }

        logger.setProjectId(artifact.project_id);

        // Check if already has embeddings
        if (!body.forceReprocess) {
          const { count } = await adminClient
            .from('document_embeddings')
            .select('*', { count: 'exact', head: true })
            .eq('artifact_id', body.artifactId);

          if (count && count > 0) {
            return jsonResponse({
              message: 'Embeddings already exist',
              existingChunks: count,
              skipped: true,
            }, 200, requestId);
          }
        }

        // Get text content
        if (artifact.content) {
          text = artifact.content;
        } else if (artifact.file_path && artifact.mime_type) {
          text = await extractTextFromFile(supabase, artifact.file_path, artifact.mime_type, logger);
        } else {
          throw new ValidationError('Artifact has no content or file');
        }

        metadata = {
          artifact_type: artifact.type,
          artifact_title: artifact.title,
          project_id: artifact.project_id,
        };

      } else {
        sourceType = 'internal_artifact';
        sourceId = body.internalArtifactId!;

        // Fetch internal artifact
        const { data: artifact, error } = await supabase
          .from('internal_artifacts')
          .select('*')
          .eq('id', body.internalArtifactId)
          .single();

        if (error || !artifact) {
          throw new ValidationError('Internal artifact not found');
        }

        if (artifact.content) {
          text = artifact.content;
        } else if (artifact.file_path && artifact.mime_type) {
          text = await extractTextFromFile(supabase, artifact.file_path, artifact.mime_type, logger);
        } else {
          throw new ValidationError('Internal artifact has no content or file');
        }

        metadata = {
          category: artifact.category,
          title: artifact.title,
          tags: artifact.tags,
        };
      }

      // Chunk and embed
      const chunks = chunkText(text);
      const insertedCount = await generateAndStoreEmbeddings(
        adminClient,
        chunks,
        sourceType,
        sourceId,
        metadata,
        logger
      );

      return jsonResponse({
        processed: true,
        sourceType,
        sourceId,
        characterCount: text.length,
        chunkCount: chunks.length,
        embeddings_stored: insertedCount,
      }, 200, requestId);
    }

    default:
      throw new ValidationError(`Unknown action: ${body.action}`);
  }
}, 'document-extraction');

serve(handler);
