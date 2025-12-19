// Supabase Edge Function: voice-transcription
// Convert audio to text and generate meeting minutes

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
} from '../_shared/supabase.ts';
import { getDashScopeClient, ChatMessage } from '../_shared/dashscope.ts';
import { getPromptTemplate, fillPromptTemplate } from '../_shared/prompts.ts';
import {
  ValidationError,
  AuthenticationError,
  ExternalServiceError,
} from '../_shared/errors.ts';
import { Logger } from '../_shared/logger.ts';

// Request types
interface TranscriptionRequest {
  action: 'transcribe' | 'generate_minutes' | 'transcribe_and_generate';
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
  transcript?: string;
  projectId?: string;
  meetingTitle?: string;
  meetingDate?: string;
  attendees?: string[];
  saveAsArtifact?: boolean;
}

// DashScope Paraformer ASR API (Alibaba's speech recognition)
const PARAFORMER_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';

interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  duration: number;
}

// Transcribe audio using DashScope Paraformer
async function transcribeAudio(
  audioData: string,
  mimeType: string,
  logger: Logger
): Promise<TranscriptionResult> {
  const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
  if (!apiKey) {
    throw new ExternalServiceError('DashScope', 'API key not configured');
  }

  logger.info('Starting audio transcription', { mimeType });

  // DashScope Paraformer request
  const requestBody = {
    model: 'paraformer-v1',
    input: {
      file_urls: undefined as string[] | undefined,
      audio: undefined as string | undefined,
    },
    parameters: {
      format: mimeType.split('/')[1] || 'wav',
      language_hints: ['en', 'id'], // English and Indonesian
      enable_timestamp: true,
      enable_diarization: true, // Speaker identification
    },
  };

  // Check if it's a URL or base64
  if (audioData.startsWith('http')) {
    requestBody.input.file_urls = [audioData];
  } else {
    requestBody.input.audio = audioData;
  }

  try {
    const response = await fetch(PARAFORMER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new ExternalServiceError('DashScope Paraformer', error.message);
    }

    interface ParaformerResponse {
      output: {
        sentence?: Array<{
          text: string;
          begin_time: number;
          end_time: number;
          speaker_id?: string;
        }>;
        text?: string;
      };
      usage: {
        duration: number;
      };
    }

    const result = await response.json() as ParaformerResponse;

    // Parse response
    const segments = (result.output.sentence || []).map(s => ({
      start: s.begin_time,
      end: s.end_time,
      text: s.text,
      speaker: s.speaker_id,
    }));

    const fullText = segments.map(s => s.text).join(' ') || result.output.text || '';

    logger.info('Transcription completed', {
      duration: result.usage.duration,
      segmentCount: segments.length,
    });

    return {
      text: fullText,
      segments,
      duration: result.usage.duration || 0,
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError('DashScope Paraformer', String(error));
  }
}

// Format transcript with speaker labels if available
function formatTranscriptWithSpeakers(segments: TranscriptionResult['segments']): string {
  if (segments.length === 0) return '';

  let currentSpeaker = '';
  const lines: string[] = [];

  for (const segment of segments) {
    const speaker = segment.speaker || 'Speaker';
    if (speaker !== currentSpeaker) {
      currentSpeaker = speaker;
      lines.push(`\n**${speaker}:**`);
    }
    lines.push(segment.text);
  }

  return lines.join(' ').trim();
}

// Generate meeting minutes from transcript
async function generateMeetingMinutes(
  transcript: string,
  meetingTitle: string,
  meetingDate: string,
  attendees: string[],
  projectName: string,
  logger: Logger
): Promise<{ content: string; confidence: number }> {
  const dashscope = getDashScopeClient();
  const template = getPromptTemplate('meeting-minutes');

  if (!template) {
    throw new ValidationError('Meeting minutes template not found');
  }

  const context = {
    transcript,
    meetingTitle: meetingTitle || 'Project Meeting',
    meetingDate: meetingDate || new Date().toISOString().split('T')[0],
    attendees: attendees?.join(', ') || 'Not specified',
    projectName: projectName || 'Project',
  };

  const { systemPrompt, userPrompt } = fillPromptTemplate(template, context);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  logger.info('Generating meeting minutes', { transcriptLength: transcript.length });

  const response = await dashscope.chatCompletion(messages, {
    temperature: template.temperature,
    maxTokens: template.maxTokens,
  });

  // Calculate confidence based on response
  let confidence = 0.8;
  if (response.content.includes('[UNCLEAR]') || response.content.includes('[INAUDIBLE]')) {
    confidence -= 0.1;
  }
  if (attendees.length === 0) {
    confidence -= 0.1;
  }

  return {
    content: response.content,
    confidence: Math.max(0.3, confidence),
  };
}

// Main handler
const handler = createHandler(async (req: Request, logger: Logger, requestId: string) => {
  validateMethod(req, ['POST']);

  const authHeader = requireAuthHeader(req);
  const supabase = createSupabaseClient(authHeader);

  // Authenticate user
  const user = await getCurrentUser(supabase);
  if (!user) {
    throw new AuthenticationError();
  }

  logger.setUserId(user.id);

  const body = await parseJsonBody<TranscriptionRequest>(req);

  switch (body.action) {
    case 'transcribe': {
      if (!body.audioUrl && !body.audioBase64) {
        throw new ValidationError('audioUrl or audioBase64 is required');
      }

      const audioData = body.audioUrl || body.audioBase64!;
      const mimeType = body.mimeType || 'audio/wav';

      const result = await transcribeAudio(audioData, mimeType, logger);
      const formattedTranscript = formatTranscriptWithSpeakers(result.segments);

      return jsonResponse({
        transcript: result.text,
        formattedTranscript,
        segments: result.segments,
        duration: result.duration,
        segmentCount: result.segments.length,
      }, 200, requestId);
    }

    case 'generate_minutes': {
      if (!body.transcript) {
        throw new ValidationError('transcript is required');
      }

      // Get project name if projectId provided
      let projectName = 'Project';
      if (body.projectId) {
        logger.setProjectId(body.projectId);
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', body.projectId)
          .single();
        projectName = project?.name || 'Project';
      }

      const result = await generateMeetingMinutes(
        body.transcript,
        body.meetingTitle || 'Meeting',
        body.meetingDate || new Date().toISOString().split('T')[0],
        body.attendees || [],
        projectName,
        logger
      );

      // Save as artifact if requested
      let artifact = null;
      if (body.saveAsArtifact && body.projectId) {
        const { data } = await supabase
          .from('artifacts')
          .insert({
            project_id: body.projectId,
            type: 'meeting_minutes',
            title: body.meetingTitle || `Meeting Minutes - ${body.meetingDate}`,
            content: result.content,
            status: 'draft',
            ai_generated: true,
            ai_confidence: result.confidence,
            created_by: user.id,
          })
          .select()
          .single();
        artifact = data;
      }

      return jsonResponse({
        minutes: result.content,
        confidence: result.confidence,
        artifact: artifact ? { id: artifact.id } : null,
      }, 200, requestId);
    }

    case 'transcribe_and_generate': {
      if (!body.audioUrl && !body.audioBase64) {
        throw new ValidationError('audioUrl or audioBase64 is required');
      }

      // Step 1: Transcribe
      const audioData = body.audioUrl || body.audioBase64!;
      const mimeType = body.mimeType || 'audio/wav';

      logger.info('Starting transcribe and generate flow');

      const transcription = await transcribeAudio(audioData, mimeType, logger);
      const formattedTranscript = formatTranscriptWithSpeakers(transcription.segments);

      // Step 2: Generate minutes
      let projectName = 'Project';
      if (body.projectId) {
        logger.setProjectId(body.projectId);
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', body.projectId)
          .single();
        projectName = project?.name || 'Project';
      }

      const minutes = await generateMeetingMinutes(
        formattedTranscript || transcription.text,
        body.meetingTitle || 'Meeting',
        body.meetingDate || new Date().toISOString().split('T')[0],
        body.attendees || [],
        projectName,
        logger
      );

      // Save as artifact if requested
      let artifact = null;
      if (body.saveAsArtifact && body.projectId) {
        const { data } = await supabase
          .from('artifacts')
          .insert({
            project_id: body.projectId,
            type: 'meeting_minutes',
            title: body.meetingTitle || `Meeting Minutes - ${body.meetingDate}`,
            content: minutes.content,
            status: 'draft',
            ai_generated: true,
            ai_confidence: minutes.confidence,
            ai_prompt_used: `Transcribed and generated from ${Math.round(transcription.duration / 1000)}s audio`,
            created_by: user.id,
          })
          .select()
          .single();
        artifact = data;
      }

      return jsonResponse({
        transcription: {
          text: transcription.text,
          formattedTranscript,
          duration: transcription.duration,
          segmentCount: transcription.segments.length,
        },
        minutes: {
          content: minutes.content,
          confidence: minutes.confidence,
        },
        artifact: artifact ? { id: artifact.id } : null,
      }, 200, requestId);
    }

    default:
      throw new ValidationError(`Unknown action: ${body.action}`);
  }
}, 'voice-transcription');

serve(handler);
