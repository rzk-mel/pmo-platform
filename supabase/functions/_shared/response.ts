// Supabase Edge Functions - HTTP Response Helpers
// Standardized JSON response formatting with CORS

import { AppError, formatErrorResponse, normalizeError } from './errors.ts';
import { Logger } from './logger.ts';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Success response interface
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
  requestId?: string;
}

// Create success response
export function jsonResponse<T>(
  data: T,
  status: number = 200,
  requestId?: string,
  meta?: SuccessResponse['meta']
): Response {
  const body: SuccessResponse<T> = {
    success: true,
    data,
    requestId,
  };

  if (meta) {
    body.meta = meta;
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Create error response
export function errorResponse(
  error: unknown,
  requestId?: string,
  logger?: Logger
): Response {
  const appError = normalizeError(error);

  if (logger) {
    if (appError.isOperational) {
      logger.warn('Operational error', { error: appError.message, code: appError.code });
    } else {
      logger.error('Unexpected error', appError as Error);
    }
  }

  const body = formatErrorResponse(appError, requestId);

  return new Response(JSON.stringify(body), {
    status: appError.statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Handle CORS preflight
export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Generate unique request ID
export function generateRequestId(): string {
  return crypto.randomUUID();
}

// Validate request method
export function validateMethod(req: Request, allowedMethods: string[]): void {
  if (!allowedMethods.includes(req.method)) {
    throw new AppError(
      `Method ${req.method} not allowed`,
      405,
      'METHOD_NOT_ALLOWED'
    );
  }
}

// Parse JSON body with validation
export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    return body as T;
  } catch {
    throw new AppError('Invalid JSON body', 400, 'INVALID_JSON');
  }
}

// Extract auth header
export function getAuthHeader(req: Request): string | null {
  return req.headers.get('Authorization');
}

// Require auth header
export function requireAuthHeader(req: Request): string {
  const authHeader = getAuthHeader(req);
  if (!authHeader) {
    throw new AppError('Authorization header required', 401, 'AUTH_REQUIRED');
  }
  return authHeader;
}

// Create streaming response (for AI streaming)
export function streamingResponse(
  stream: ReadableStream,
  requestId?: string
): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-Id': requestId || '',
    },
  });
}

// Standard handler wrapper with error handling
export function createHandler(
  handler: (req: Request, logger: Logger, requestId: string) => Promise<Response>,
  functionName: string
) {
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return corsPreflightResponse();
    }

    const { createLogger } = await import('./logger.ts');
    const requestId = generateRequestId();
    const logger = createLogger(functionName).setRequestId(requestId);

    try {
      logger.info('Request started', {
        method: req.method,
        url: req.url,
      });

      const response = await handler(req, logger, requestId);

      logger.info('Request completed', {
        status: response.status,
      });

      return response;
    } catch (error) {
      return errorResponse(error, requestId, logger);
    }
  };
}
