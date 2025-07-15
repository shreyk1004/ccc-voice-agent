import { fal } from '@fal-ai/client';

export interface TranscriptionOptions {
  language?: string;
  model: 'fal-whisper' | 'google' | 'azure';
  timestamp: boolean;
  speakerDiarization: boolean;
}

export interface TranscriptionRequest {
  audioBuffer: Buffer;
  mimeType: string;
  fileName: string;
  userId: string;
  options: TranscriptionOptions;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
  }>;
  model: string;
  duration?: number;
  wordCount: number;
}

export class SpeechToTextService {
  constructor() {
    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is required');
    }
    
    // Configure fal.ai client
    fal.config({
      credentials: process.env.FAL_KEY,
    });
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    try {
      console.log(`Starting transcription for user ${request.userId} using model ${request.options.model}`);
      
      switch (request.options.model) {
        case 'fal-whisper':
          return await this.transcribeWithFalWhisper(request);
        case 'google':
          return await this.transcribeWithGoogle(request);
        case 'azure':
          return await this.transcribeWithAzure(request);
        default:
          throw new Error(`Unsupported transcription model: ${request.options.model}`);
      }
    } catch (error) {
      console.error('Transcription service error:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async transcribeWithFalWhisper(request: TranscriptionRequest): Promise<TranscriptionResult> {
    try {
      // Upload audio file to fal.ai storage
      const file = new File([request.audioBuffer], request.fileName, {
        type: request.mimeType,
      });
      
      console.log('Uploading audio file to fal.ai storage...');
      const audioUrl = await fal.storage.upload(file);
      
      console.log('Starting fal.ai Whisper transcription...');
      const result = await fal.subscribe('fal-ai/whisper', {
        input: {
          audio_url: audioUrl,
          task: 'transcribe',
          language: request.options.language as any, // Cast to any for language compatibility
          diarize: request.options.speakerDiarization,
          chunk_level: request.options.timestamp ? 'segment' : 'word',
          version: '3',
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('Transcription in progress...');
          }
        },
      });

      // Map fal.ai response to our TranscriptionResult format
      const transcriptionResult: TranscriptionResult = {
        text: result.data.text,
        model: 'fal-whisper',
        wordCount: result.data.text.split(' ').length,
        confidence: 0.9, // fal.ai doesn't provide confidence, using default
      };

      // Add language if detected
      if (result.data.inferred_languages && result.data.inferred_languages.length > 0) {
        transcriptionResult.language = result.data.inferred_languages[0];
      }

      // Add segments/chunks if available
      if (result.data.chunks && result.data.chunks.length > 0) {
        transcriptionResult.segments = result.data.chunks.map((chunk: any) => ({
          text: chunk.text,
          start: chunk.timestamp[0],
          end: chunk.timestamp[1],
          speaker: chunk.speaker, // Available if diarization is enabled
        }));
      }

      return transcriptionResult;
    } catch (error) {
      console.error('Fal.ai Whisper transcription error:', error);
      throw new Error(`Fal.ai Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async transcribeWithGoogle(request: TranscriptionRequest): Promise<TranscriptionResult> {
    // TODO: Implement Google Speech-to-Text integration
    console.log('Google Speech-to-Text integration not yet implemented');
    
    // Placeholder implementation
    return {
      text: 'Google Speech-to-Text integration coming soon...',
      model: 'google',
      wordCount: 6,
    };
  }

  private async transcribeWithAzure(request: TranscriptionRequest): Promise<TranscriptionResult> {
    // TODO: Implement Azure Speech Services integration
    console.log('Azure Speech Services integration not yet implemented');
    
    // Placeholder implementation
    return {
      text: 'Azure Speech Services integration coming soon...',
      model: 'azure',
      wordCount: 6,
    };
  }

  // Utility method to validate audio file
  static validateAudioFile(buffer: Buffer, mimeType: string, maxSizeBytes: number = 50000000): void {
    if (buffer.length > maxSizeBytes) {
      throw new Error(`File size ${buffer.length} bytes exceeds maximum allowed size of ${maxSizeBytes} bytes`);
    }

    const supportedMimeTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/webm',
      'audio/flac'
    ];

    if (!supportedMimeTypes.includes(mimeType)) {
      throw new Error(`Unsupported audio format: ${mimeType}. Supported formats: ${supportedMimeTypes.join(', ')}`);
    }
  }

  // Method to estimate transcription cost (useful for user information)
  static estimateTranscriptionCost(durationMinutes: number, model: string): number {
    // Rough cost estimates (these would need to be updated with actual pricing)
    const costPerMinute = {
      'fal-whisper': 0.005, // Estimated fal.ai Whisper pricing (typically lower than OpenAI)
      'google': 0.016,      // Estimated Google pricing
      'azure': 0.012        // Estimated Azure pricing
    };

    return (costPerMinute[model as keyof typeof costPerMinute] || 0.005) * durationMinutes;
  }
} 