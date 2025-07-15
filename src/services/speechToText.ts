import OpenAI from 'openai';

export interface TranscriptionOptions {
  language?: string;
  model: 'whisper-1' | 'google' | 'azure';
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
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    try {
      console.log(`Starting transcription for user ${request.userId} using model ${request.options.model}`);
      
      switch (request.options.model) {
        case 'whisper-1':
          return await this.transcribeWithWhisper(request);
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

  private async transcribeWithWhisper(request: TranscriptionRequest): Promise<TranscriptionResult> {
    try {
      // Convert Buffer to File-like object for OpenAI API
      const file = new File([request.audioBuffer], request.fileName, {
        type: request.mimeType,
      });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: request.options.language,
        response_format: request.options.timestamp ? 'verbose_json' : 'json',
        timestamp_granularities: request.options.timestamp ? ['segment'] : undefined,
      });

      // Handle transcription response (always an object in modern OpenAI API)
      const result: TranscriptionResult = {
        text: transcription.text,
        language: (transcription as any).language,
        model: 'whisper-1',
        duration: (transcription as any).duration,
        wordCount: transcription.text.split(' ').length,
      };

      // Add segments if available
      if ((transcription as any).segments && request.options.timestamp) {
        result.segments = (transcription as any).segments.map((segment: any) => ({
          text: segment.text,
          start: segment.start,
          end: segment.end,
        }));
      }

      return result;
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw new Error(`Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      'whisper-1': 0.006, // $0.006 per minute for Whisper
      'google': 0.016,    // Estimated Google pricing
      'azure': 0.012      // Estimated Azure pricing
    };

    return (costPerMinute[model as keyof typeof costPerMinute] || 0.006) * durationMinutes;
  }
} 