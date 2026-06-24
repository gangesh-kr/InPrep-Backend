import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

// Initialize Supabase client if credentials exist
let supabase: any = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  } catch (err) {
    logger.error(err, 'Failed to initialize Supabase client for VoiceService');
  }
}

export class VoiceService {
  static async transcribeAudio(fileBuffer: Buffer, fileName: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, 'MISSING_API_KEY', 'OPENAI_API_KEY is not defined in the environment.');
    }

    // Call OpenAI Whisper API using global fetch with multipart form-data
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'audio/webm' });
      formData.append('file', blob, fileName || 'audio.webm');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as any;
        logger.error({ error: errData }, 'Whisper API transcription error');
        throw new ApiError(response.status, 'TRANSCRIPTION_FAILED', errData.error?.message || 'Failed to transcribe audio.');
      }

      const result = (await response.json()) as any;
      return result.text || '';
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error transcribing audio in VoiceService');
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, 'TRANSCRIPTION_FAILED', err.message || 'Error occurred during transcription.');
    }
  }

  static async synthesizeText(text: string, voice: string = 'alloy'): Promise<Buffer> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, 'MISSING_API_KEY', 'OPENAI_API_KEY is not defined in the environment.');
    }

    const processedText = text.toLowerCase().trim();
    const textHash = crypto.createHash('sha256').update(processedText).digest('hex');
    const cacheFileName = `${textHash}-${voice}.mp3`;

    // 1. Try to fetch from Supabase Storage Cache
    if (supabase) {
      try {
        const { data, error } = await supabase.storage.from('voice-cache').download(cacheFileName);
        if (data && !error) {
          logger.info({ cacheFileName }, 'Served synthesized audio from Supabase Storage Cache');
          const arrayBuffer = await data.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, 'Failed to download from Supabase Storage, generating via OpenAI TTS...');
      }
    }

    // 2. Fallback to calling OpenAI TTS API
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice
        })
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as any;
        logger.error({ error: errData }, 'OpenAI TTS synthesis error');
        throw new ApiError(response.status, 'SYNTHESIS_FAILED', errData.error?.message || 'Failed to synthesize text.');
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // 3. Save to Supabase Storage Cache asynchronously (fire-and-forget)
      if (supabase) {
        setImmediate(async () => {
          try {
            const { error } = await supabase.storage.from('voice-cache').upload(cacheFileName, audioBuffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
            if (error) {
              logger.warn({ error: error.message }, 'Failed to cache audio in Supabase Storage');
            } else {
              logger.info({ cacheFileName }, 'Cached synthesized audio in Supabase Storage');
            }
          } catch (e: any) {
            logger.warn({ error: e.message }, 'Exception caching audio in Supabase Storage');
          }
        });
      }

      return audioBuffer;
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error synthesizing speech in VoiceService');
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, 'SYNTHESIS_FAILED', err.message || 'Error occurred during speech synthesis.');
    }
  }
}

export default VoiceService;
