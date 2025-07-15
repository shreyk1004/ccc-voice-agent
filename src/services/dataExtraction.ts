import OpenAI from 'openai';

export type ExtractionType = 'repair_details' | 'parts_inventory' | 'labor_hours' | 'customer_info' | 'damage_assessment' | 'custom';

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

    if (extractionType === 'custom') {
      if (!customSchema) {
        throw new Error('Custom schema is required for custom extraction type');
      }
      return basePrompt + `Extract the following custom fields based on this schema:
Description: ${customSchema.description}
Fields to extract: ${customSchema.fields.join(', ')}

Format your response as JSON using the field names provided. Include a "confidence" field (0.0-1.0).`;
    }

    // Comprehensive extraction for all automotive data
    return basePrompt + `Extract ALL available information from the transcription. Include any fields that apply, leave others empty (""):

CUSTOMER INFORMATION:
- customer_name: Customer's name if mentioned
- contact_info: Phone, email, or address if mentioned
- service_requests: What services were requested

VEHICLE INFORMATION:
- vin: VIN number if mentioned
- vehicle_type: Standard, Commercial, etc.
- type: Pickup, Sedan, SUV, etc.
- year: Vehicle year
- make: Vehicle manufacturer (e.g., Chevrolet, Ford)
- model: Full model name and trim
- body_style: Body style description (e.g., "2-Door Pickup")
- engine: Engine specifications
- interior_color: Interior color
- exterior_color: Exterior color
- paint_code: Paint code if mentioned
- trim_code: Trim code if mentioned
- license_plate: License plate number
- license_state: License plate state
- license_expiration: License expiration date
- job_number: Job or work order number
- production_date: Vehicle production date
- mileage_in: Mileage when vehicle arrived
- mileage_out: Mileage when vehicle completed
- fuel_level: Fuel level (Full, Half, Quarter, etc.)

DAMAGE & ASSESSMENT:
- repairable_condition: Overall vehicle condition (Good, Fair, Poor)
- primary_impact: Primary point of impact
- secondary_impact: Secondary point of impact if any
- drivable_status: Whether vehicle is drivable
- impact_notes: Description of damage areas and impact details
- prior_damage_notes: Any prior damage noted
- problem_description: What the customer reported as the issue
- diagnosis: What the technician found during inspection

REPAIR WORK:
- repairs_performed: Specific repair work done
- labor_type: Type of labor required (body, mechanical, paint)
- tasks_performed: List of specific tasks done
- time_per_task: Time spent on each task
- total_hours: Total labor time
- labor_time: Time spent on different tasks
- difficulty_level: How complex the work was (easy/medium/hard)
- technician_notes: Any notes about the work performed

PARTS & OPERATIONS:
- parts_used: Parts replaced or installed
- part_numbers: Specific part numbers mentioned
- part_descriptions: Description of parts used
- quantities: How many of each part
- suppliers: Where parts were sourced from
- costs: Part costs if mentioned
- installation_notes: Any special installation requirements
- paint_needed: Whether paint is needed and type/code
- operation_notes: Additional operation notes
- estimate_line: Estimate line item number
- operation_type: Type of operation (Replace, Repair, Refinish)
- operation_description: Description of repair operation
- quantity: Quantity of parts or hours
- unit_price: Unit price for parts or hourly rate
- estimated_total: Total estimated cost

RECOMMENDATIONS:
- recommendations: Future maintenance suggestions

Format your response as JSON with these exact field names. Leave fields empty ("") if not mentioned in the transcription. Include a "confidence" field (0.0-1.0) indicating your confidence in the extraction.`;
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