// Supabase Edge Functions - Google Gemini AI Client
// Wrapper for Google Gemini API with guardrails

import { AIError } from './errors.ts';
import { createLogger } from './logger.ts';

const logger = createLogger('gemini-client');

// Gemini API Configuration
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'model';
  content: string;
}

export interface ChatCompletionOptions {
  model?: 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash-exp';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
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

interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

class GeminiClient {
  private apiKey: string;

  constructor() {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new AIError('GEMINI_API_KEY not configured');
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
      const url = `${GEMINI_BASE_URL}${endpoint}?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json() as GeminiError;
        throw new AIError(`Gemini API error: ${error.error?.message || 'Unknown error'}`, {
          code: error.error?.status,
          status: response.status,
        });
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof AIError) throw error;
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError('Gemini request timeout');
      }

      throw new AIError(`Gemini request failed: ${error}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    const {
      model = 'gemini-1.5-flash',
      temperature = 0.3,
      maxTokens = 2000,
      topP = 0.8,
    } = options;

    logger.info('Chat completion request', {
      model,
      messageCount: messages.length,
      temperature,
    });

    // Convert messages to Gemini format
    const systemInstruction = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n');

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const requestBody = {
      contents,
      systemInstruction: systemInstruction ? {
        parts: [{ text: systemInstruction }],
      } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP,
      },
    };

    interface GeminiChatResponse {
      candidates: Array<{
        content: {
          parts: Array<{ text: string }>;
          role: string;
        };
        finishReason: string;
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    }

    const response = await this.request<GeminiChatResponse>(
      `/models/${model}:generateContent`,
      requestBody
    );

    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    logger.info('Chat completion success', {
      model,
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    });

    return {
      id: crypto.randomUUID(),
      model,
      content,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
      finishReason: response.candidates?.[0]?.finishReason || 'STOP',
    };
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    logger.debug('Generating embedding', { textLength: text.length });

    const requestBody = {
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text }],
      },
    };

    interface GeminiEmbeddingResponse {
      embedding: {
        values: number[];
      };
    }

    const response = await this.request<GeminiEmbeddingResponse>(
      '/models/text-embedding-004:embedContent',
      requestBody
    );

    return {
      embedding: response.embedding.values,
      usage: {
        totalTokens: Math.ceil(text.length / 4), // Approximate
      },
    };
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    // Gemini batch embedding
    const requests = texts.map(text => ({
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text }],
      },
    }));

    const requestBody = {
      requests,
    };

    interface GeminiBatchEmbeddingResponse {
      embeddings: Array<{
        values: number[];
      }>;
    }

    const response = await this.request<GeminiBatchEmbeddingResponse>(
      '/models/text-embedding-004:batchEmbedContents',
      requestBody
    );

    return response.embeddings.map((e, i) => ({
      embedding: e.values,
      usage: { totalTokens: Math.ceil(texts[i].length / 4) },
    }));
  }
}

// Singleton instance
let clientInstance: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!clientInstance) {
    clientInstance = new GeminiClient();
  }
  return clientInstance;
}

// Backward compatibility alias
export const getDashScopeClient = getGeminiClient;

export { GeminiClient };
