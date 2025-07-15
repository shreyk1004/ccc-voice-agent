import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { DataExtractionService } from '../services/dataExtraction';

const router = Router();

// Validation schemas
const extractionRequestSchema = z.object({
  transcription: z.string().min(10, 'Transcription text must be at least 10 characters'),
  extractionType: z.enum(['repair_details', 'parts_inventory', 'labor_hours', 'customer_info', 'custom']).default('repair_details'),
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
  extractionType: z.enum(['repair_details', 'parts_inventory', 'labor_hours', 'customer_info', 'custom']).default('repair_details'),
  customSchema: z.object({
    fields: z.array(z.string()),
    description: z.string()
  }).optional()
});

// POST /api/extraction/extract
router.post('/extract', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate request data
    const validatedData = extractionRequestSchema.parse(req.body);
    
    // Initialize data extraction service
    const extractionService = new DataExtractionService();
    
    // Perform data extraction
    const extractedData = await extractionService.extractData({
      transcription: validatedData.transcription,
      extractionType: validatedData.extractionType,
      customSchema: validatedData.customSchema,
      userId: req.user.id
    });

    res.status(200).json({
      success: true,
      extractedData,
      metadata: {
        extractionType: validatedData.extractionType,
        transcriptionLength: validatedData.transcription.length,
        timestamp: new Date().toISOString(),
        userId: req.user.id
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
router.post('/batch', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate batch request data
    const validatedData = batchExtractionSchema.parse(req.body);
    
    // Initialize data extraction service
    const extractionService = new DataExtractionService();
    
    // Perform batch data extraction
    const batchResults = await extractionService.extractDataBatch({
      transcriptions: validatedData.transcriptions,
      extractionType: validatedData.extractionType,
      customSchema: validatedData.customSchema,
      userId: req.user.id
    });

    res.status(200).json({
      success: true,
      results: batchResults,
      metadata: {
        extractionType: validatedData.extractionType,
        batchSize: validatedData.transcriptions.length,
        timestamp: new Date().toISOString(),
        userId: req.user.id
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
router.get('/schemas', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Return available extraction schemas
    const schemas = {
      repair_details: {
        description: 'Extract repair work details, issues, and solutions',
        fields: ['vehicle_info', 'problem_description', 'diagnosis', 'repairs_performed', 'parts_used', 'labor_time', 'recommendations']
      },
      parts_inventory: {
        description: 'Extract parts information and inventory details',
        fields: ['part_numbers', 'part_descriptions', 'quantities', 'suppliers', 'costs', 'installation_notes']
      },
      labor_hours: {
        description: 'Extract labor time and work breakdown',
        fields: ['tasks_performed', 'time_per_task', 'total_hours', 'technician_notes', 'difficulty_level']
      },
      customer_info: {
        description: 'Extract customer and vehicle information',
        fields: ['customer_name', 'contact_info', 'vehicle_year', 'vehicle_make', 'vehicle_model', 'vin', 'mileage', 'service_requests']
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
router.get('/history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

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