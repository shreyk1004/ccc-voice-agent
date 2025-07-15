import { Router, Request, Response } from 'express';
import { z } from 'zod';
// import { AuthenticatedRequest } from '../middleware/auth'; // Removed for testing
import { DataExtractionService } from '../services/dataExtraction';

const router = Router();

// Validation schemas
const extractionRequestSchema = z.object({
  transcription: z.string().min(10, 'Transcription text must be at least 10 characters'),
  extractionType: z.enum(['repair_details', 'parts_inventory', 'labor_hours', 'customer_info', 'damage_assessment', 'custom']).default('repair_details'),
  customSchema: z.object({
    fields: z.array(z.string()),
    description: z.string()
  }).optional()
});

const batchExtractionSchema = z.object({
  transcriptions: z.array(z.object({
    id: z.string(),
    text: z.string().min(10)
  })).min(1).max(10), // Limit batch processing to 10 items
  extractionType: z.enum(['repair_details', 'parts_inventory', 'labor_hours', 'customer_info', 'damage_assessment', 'custom']).default('repair_details'),
  customSchema: z.object({
    fields: z.array(z.string()),
    description: z.string()
  }).optional()
});

// POST /api/extraction/extract
router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validatedData = extractionRequestSchema.parse(req.body);
    
    // Initialize data extraction service
    const extractionService = new DataExtractionService();
    
    // Perform data extraction
    const extractedData = await extractionService.extractData({
      transcription: validatedData.transcription,
      extractionType: validatedData.extractionType,
      customSchema: validatedData.customSchema,
      userId: 'test-user' // Hardcoded for testing
    });

          res.status(200).json({
        success: true,
        extractedData,
        metadata: {
          extractionType: validatedData.extractionType,
          transcriptionLength: validatedData.transcription.length,
          timestamp: new Date().toISOString(),
          userId: 'test-user'
        }
      });

  } catch (error) {
    console.error('Data extraction error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid extraction request',
        details: error.errors
      });
      return;
    }

    if (error instanceof Error && error.message.includes('rate limit')) {
      res.status(429).json({ error: 'Rate limit exceeded for extraction service' });
      return;
    }

    res.status(500).json({ error: 'Data extraction failed' });
  }
});

// POST /api/extraction/batch
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {

    // Validate batch request data
    const validatedData = batchExtractionSchema.parse(req.body);
    
    // Initialize data extraction service
    const extractionService = new DataExtractionService();
    
    // Perform batch data extraction
    const batchResults = await extractionService.extractDataBatch({
      transcriptions: validatedData.transcriptions,
      extractionType: validatedData.extractionType,
      customSchema: validatedData.customSchema,
      userId: 'test-user'
    });

    res.status(200).json({
      success: true,
      results: batchResults,
      metadata: {
        extractionType: validatedData.extractionType,
        batchSize: validatedData.transcriptions.length,
        timestamp: new Date().toISOString(),
        userId: 'test-user'
      }
    });

  } catch (error) {
    console.error('Batch extraction error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid batch extraction request',
        details: error.errors
      });
      return;
    }

    if (error instanceof Error && error.message.includes('rate limit')) {
      res.status(429).json({ error: 'Rate limit exceeded for batch extraction' });
      return;
    }

    res.status(500).json({ error: 'Batch data extraction failed' });
  }
});

// GET /api/extraction/schemas
router.get('/schemas', async (req: Request, res: Response): Promise<void> => {
  try {

    // Return comprehensive extraction schema (all extraction types use the same comprehensive schema now)
    const schemas = {
      comprehensive: {
        description: 'Extract all available automotive repair and assessment information',
        categories: {
          customer_information: ['customer_name', 'contact_info', 'service_requests'],
          vehicle_information: ['vin', 'vehicle_type', 'type', 'year', 'make', 'model', 'body_style', 'engine', 'interior_color', 'exterior_color', 'paint_code', 'trim_code', 'license_plate', 'license_state', 'license_expiration', 'job_number', 'production_date', 'mileage_in', 'mileage_out', 'fuel_level'],
          damage_assessment: ['repairable_condition', 'primary_impact', 'secondary_impact', 'drivable_status', 'impact_notes', 'prior_damage_notes', 'problem_description', 'diagnosis'],
          repair_work: ['repairs_performed', 'labor_type', 'tasks_performed', 'time_per_task', 'total_hours', 'labor_time', 'difficulty_level', 'technician_notes'],
          parts_operations: ['parts_used', 'part_numbers', 'part_descriptions', 'quantities', 'suppliers', 'costs', 'installation_notes', 'paint_needed', 'operation_notes', 'estimate_line', 'operation_type', 'operation_description', 'quantity', 'unit_price', 'estimated_total'],
          recommendations: ['recommendations']
        },
        total_fields: 47
      },
      custom: {
        description: 'Define your own extraction schema',
        fields: ['custom_fields_defined_by_user']
      }
    };

    res.status(200).json({
      success: true,
      schemas,
      message: 'Available extraction schemas'
    });

  } catch (error) {
    console.error('Schema retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve extraction schemas' });
  }
});

// GET /api/extraction/history
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {

    // TODO: Implement extraction history retrieval from database
    // For now, return empty array
    res.status(200).json({
      success: true,
      extractions: [],
      message: 'Extraction history not yet implemented'
    });

  } catch (error) {
    console.error('History retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve extraction history' });
  }
});

export { router as extractionRoutes }; 