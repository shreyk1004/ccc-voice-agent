import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
// import { AuthenticatedRequest } from '../middleware/auth'; // Removed for testing
import { SpeechToTextService } from '../services/speechToText';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '50000000'), // 50MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/wav', 
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/webm',
      'audio/flac'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// Validation schemas
const transcriptionOptionsSchema = z.object({
  language: z.string().optional(),
  model: z.enum(['fal-whisper', 'google', 'azure']).optional().default('fal-whisper'),
  timestamp: z.string().optional().transform(val => val === 'true').default('true'),
  speakerDiarization: z.string().optional().transform(val => val === 'true').default('false')
});

// POST /api/transcription/upload
router.post('/upload', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    // Parse and validate options
    const options = transcriptionOptionsSchema.parse(req.body);
    
    // Initialize speech-to-text service
    const speechService = new SpeechToTextService();
    
    // Perform transcription
    const transcriptionResult = await speechService.transcribe({
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
      userId: 'test-user', // Hardcoded for testing
      options
    });

    res.status(200).json({
      success: true,
      transcription: transcriptionResult,
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        model: options.model,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid options provided',
        details: error.errors
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('file type')) {
        res.status(400).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('File too large')) {
        res.status(400).json({ error: 'File size too large' });
        return;
      }
    }

    res.status(500).json({ error: 'Transcription failed' });
  }
});

// GET /api/transcription/history
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Implement transcription history retrieval from database
    // For now, return empty array
    res.status(200).json({
      success: true,
      transcriptions: [],
      message: 'Transcription history not yet implemented'
    });

  } catch (error) {
    console.error('History retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve transcription history' });
  }
});

// GET /api/transcription/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const transcriptionId = req.params.id;
    
    // TODO: Implement specific transcription retrieval from database
    // For now, return not found
    res.status(404).json({
      error: 'Transcription not found',
      message: 'Database integration not yet implemented'
    });

  } catch (error) {
    console.error('Transcription retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve transcription' });
  }
});

export { router as transcriptionRoutes }; 