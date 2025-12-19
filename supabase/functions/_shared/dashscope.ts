// Supabase Edge Functions - DashScope AI Client
// Wrapper for DashScope (Qwen) API with guardrails

import { AIError } from './errors.ts';
import { createLogger } from './logger.ts';

const logger = createLogger('dashscope-client');

// DashScope API Configuration
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: 'qwen-turbo' | 'qwen-plus' | 'qwen-max';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  enableSearch?: boolean;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  usage: {
    totalTokens: number;
  };
}

interface DashScopeError {
  code: string;
  message: string;
}

class DashScopeClient {
  private apiKey: string;

  constructor() {
    const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (!apiKey) {
      throw new AIError('DASHSCOPE_API_KEY not configured');
    }
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    body: unknown,
    timeoutMs: number = 60000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${DASHSCOPE_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json() as DashScopeError;
        throw new AIError(`DashScope API error: ${error.message}`, {
          code: error.code,
          status: response.status,
        });
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof AIError) throw error;
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError('DashScope request timeout');
      }

      throw new AIError(`DashScope request failed: ${error}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    const {
      model = 'qwen-turbo',
      temperature = 0.3,
      maxTokens = 2000,
      topP = 0.8,
      enableSearch = false,
    } = options;

    logger.info('Chat completion request', {
      model,
      messageCount: messages.length,
      temperature,
    });

    const requestBody = {
      model,
      input: {
        messages,
      },
      parameters: {
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        enable_search: enableSearch,
        result_format: 'message',
      },
    };

    interface DashScopeChatResponse {
      request_id: string;
      output: {
        text?: string;
        choices?: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        finish_reason?: string;
      };
      usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    }

    const response = await this.request<DashScopeChatResponse>(
      '/services/aigc/text-generation/generation',
      requestBody
    );

    const content = response.output.choices?.[0]?.message?.content 
      || response.output.text 
      || '';

    logger.info('Chat completion success', {
      requestId: response.request_id,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return {
      id: response.request_id,
      model,
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
      },
      finishReason: response.output.choices?.[0]?.finish_reason 
        || response.output.finish_reason 
        || 'stop',
    };
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    logger.debug('Generating embedding', { textLength: text.length });

    const requestBody = {
      model: 'text-embedding-v2',
      input: {
        texts: [text],
      },
      parameters: {
        text_type: 'document',
      },
    };

    interface DashScopeEmbeddingResponse {
      output: {
        embeddings: Array<{
          text_index: number;
          embedding: number[];
        }>;
      };
      usage: {
        total_tokens: number;
      };
    }

    const response = await this.request<DashScopeEmbeddingResponse>(
      '/services/embeddings/text-embedding/text-embedding',
      requestBody
    );

    return {
      embedding: response.output.embeddings[0].embedding,
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    // DashScope supports batch embedding
    const requestBody = {
      model: 'text-embedding-v2',
      input: {
        texts,
      },
      parameters: {
        text_type: 'document',
      },
    };

    interface DashScopeEmbeddingResponse {
      output: {
        embeddings: Array<{
          text_index: number;
          embedding: number[];
        }>;
      };
      usage: {
        total_tokens: number;
      };
    }

    const response = await this.request<DashScopeEmbeddingResponse>(
      '/services/embeddings/text-embedding/text-embedding',
      requestBody
    );

    const tokensPerText = Math.floor(response.usage.total_tokens / texts.length);

    return response.output.embeddings.map(e => ({
      embedding: e.embedding,
      usage: { totalTokens: tokensPerText },
    }));
  }
}

// Singleton instance
let clientInstance: DashScopeClient | null = null;

export function getDashScopeClient(): DashScopeClient {
  if (!clientInstance) {
    clientInstance = new DashScopeClient();
  }
  return clientInstance;
}

export { DashScopeClient };
