import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { transcriptionRoutes } from './routes/transcription';
import { authRoutes } from './routes/auth';
import { extractionRoutes } from './routes/extraction';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '1') || 1) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5') || 5,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/transcription', authMiddleware, transcriptionRoutes);
app.use('/api/extraction', authMiddleware, extractionRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 Transcription API: http://localhost:${PORT}/api/transcription`);
  console.log(`🔍 Data extraction API: http://localhost:${PORT}/api/extraction`);
});

export default app; 