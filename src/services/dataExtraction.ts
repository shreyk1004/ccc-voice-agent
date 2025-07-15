import OpenAI from 'openai';

export type ExtractionType = 'repair_details' | 'parts_inventory' | 'labor_hours' | 'customer_info' | 'custom';

export interface CustomSchema {
  fields: string[];
  description: string;
}

export interface ExtractionRequest {
  transcription: string;
  extractionType: ExtractionType;
  customSchema?: CustomSchema;
  userId: string;
}

export interface BatchExtractionRequest {
  transcriptions: Array<{ id: string; text: string }>;
  extractionType: ExtractionType;
  customSchema?: CustomSchema;
  userId: string;
}

export interface ExtractionResult {
  success: boolean;
  extractedData: Record<string, any>;
  confidence: number;
  extractionType: ExtractionType;
  processingTime: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface BatchExtractionResult {
  id: string;
  result: ExtractionResult;
  error?: string;
}

export class DataExtractionService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async extractData(request: ExtractionRequest): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Starting data extraction for user ${request.userId} with type ${request.extractionType}`);
      
      const prompt = this.buildExtractionPrompt(request.transcription, request.extractionType, request.customSchema);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert data extraction assistant specializing in automotive repair transcriptions. Extract structured data accurately and provide confidence scores for your extractions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent extractions
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No response from extraction model');
      }

      const extractedData = JSON.parse(responseText);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        extractedData,
        confidence: extractedData.confidence || 0.8,
        extractionType: request.extractionType,
        processingTime,
        tokens: {
          prompt: completion.usage?.prompt_tokens || 0,
          completion: completion.usage?.completion_tokens || 0,
          total: completion.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      console.error('Data extraction error:', error);
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        extractedData: { error: error instanceof Error ? error.message : 'Unknown extraction error' },
        confidence: 0,
        extractionType: request.extractionType,
        processingTime
      };
    }
  }

  async extractDataBatch(request: BatchExtractionRequest): Promise<BatchExtractionResult[]> {
    console.log(`Starting batch extraction for ${request.transcriptions.length} transcriptions`);
    
    // Process in parallel with limited concurrency to avoid rate limits
    const maxConcurrent = 3;
    const results: BatchExtractionResult[] = [];
    
    for (let i = 0; i < request.transcriptions.length; i += maxConcurrent) {
      const batch = request.transcriptions.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await this.extractData({
            transcription: item.text,
            extractionType: request.extractionType,
            customSchema: request.customSchema,
            userId: request.userId
          });
          
          return {
            id: item.id,
            result
          };
        } catch (error) {
          return {
            id: item.id,
            result: {
              success: false,
              extractedData: {},
              confidence: 0,
              extractionType: request.extractionType,
              processingTime: 0
            },
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + maxConcurrent < request.transcriptions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  private buildExtractionPrompt(transcription: string, extractionType: ExtractionType, customSchema?: CustomSchema): string {
    const basePrompt = `Extract structured data from the following automotive repair transcription. Return your response as a valid JSON object.

Transcription:
"${transcription}"

`;

    switch (extractionType) {
      case 'repair_details':
        return basePrompt + `Extract the following repair details:
- vehicle_info: Year, make, model, VIN if mentioned
- problem_description: What the customer reported as the issue
- diagnosis: What the technician found during inspection
- repairs_performed: Specific repair work done
- parts_used: Parts replaced or installed
- labor_time: Time spent on different tasks
- recommendations: Future maintenance suggestions

Format your response as JSON with these exact field names. Include a "confidence" field (0.0-1.0) indicating your confidence in the extraction.`;

      case 'parts_inventory':
        return basePrompt + `Extract parts and inventory information:
- part_numbers: Specific part numbers mentioned
- part_descriptions: Description of parts used
- quantities: How many of each part
- suppliers: Where parts were sourced from
- costs: Part costs if mentioned
- installation_notes: Any special installation requirements

Format your response as JSON with these exact field names. Include a "confidence" field (0.0-1.0).`;

      case 'labor_hours':
        return basePrompt + `Extract labor and time information:
- tasks_performed: List of specific tasks done
- time_per_task: Time spent on each task
- total_hours: Total labor time
- technician_notes: Any notes about the work performed
- difficulty_level: How complex the work was (easy/medium/hard)

Format your response as JSON with these exact field names. Include a "confidence" field (0.0-1.0).`;

      case 'customer_info':
        return basePrompt + `Extract customer and vehicle information:
- customer_name: Customer's name if mentioned
- contact_info: Phone, email, or address if mentioned
- vehicle_year: Year of the vehicle
- vehicle_make: Make/brand of the vehicle
- vehicle_model: Model of the vehicle
- vin: VIN number if mentioned
- mileage: Current mileage if mentioned
- service_requests: What services were requested

Format your response as JSON with these exact field names. Include a "confidence" field (0.0-1.0).`;

      case 'custom':
        if (!customSchema) {
          throw new Error('Custom schema is required for custom extraction type');
        }
        return basePrompt + `Extract the following custom fields based on this schema:
Description: ${customSchema.description}
Fields to extract: ${customSchema.fields.join(', ')}

Format your response as JSON using the field names provided. Include a "confidence" field (0.0-1.0).`;

      default:
        throw new Error(`Unsupported extraction type: ${extractionType}`);
    }
  }

  // Utility method to validate extracted data
  static validateExtractionResult(result: ExtractionResult, expectedFields: string[]): boolean {
    if (!result.success || !result.extractedData) {
      return false;
    }

    // Check if at least some expected fields are present
    const extractedFields = Object.keys(result.extractedData);
    const hasRequiredFields = expectedFields.some(field => extractedFields.includes(field));
    
    return hasRequiredFields && result.confidence > 0.3;
  }

  // Method to estimate extraction cost
  static estimateExtractionCost(transcriptionLength: number): number {
    // Rough cost estimate based on token usage
    // Assuming ~4 characters per token and GPT-4 pricing
    const estimatedTokens = Math.ceil(transcriptionLength / 4) * 2; // 2x for prompt + completion
    const costPer1KTokens = 0.03; // Approximate GPT-4 cost
    
    return (estimatedTokens / 1000) * costPer1KTokens;
  }
} 