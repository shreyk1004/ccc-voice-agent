# CCC Voice Agent

A comprehensive speech-to-text and data extraction system designed specifically for auto body shop mechanics. This system captures voice recordings from repair technicians and automatically extracts structured data for improved workflow management.

## Features

- 🎤 **Speech-to-Text Transcription**: Support for multiple models (Fal.ai Whisper, Google Speech-to-Text, Azure)
- 🔍 **Intelligent Data Extraction**: AI-powered extraction of structured repair data
- 🔐 **Secure Authentication**: JWT-based authentication with rate limiting
- 📊 **Multiple Extraction Types**: 
  - Repair details
  - Parts inventory
  - Labor hours
  - Customer information
  - Custom schemas
- 🔄 **Batch Processing**: Handle multiple transcriptions simultaneously
- 📁 **File Upload Support**: Multiple audio formats (MP3, WAV, M4A, etc.)

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **AI/ML**: Fal.ai Whisper for speech-to-text, OpenAI GPT-4 for data extraction
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Zod for request validation
- **File Handling**: Multer for audio file uploads
- **Security**: Helmet, CORS, rate limiting

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Fal.ai API key (for speech-to-text)
- OpenAI API key (for data extraction)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd ccc-voice-agent
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the root directory with the following keys:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Fal.ai Configuration (Required for speech-to-text)
FAL_KEY=your-fal-ai-api-key-here

# OpenAI Configuration (Required for data extraction)
OPENAI_API_KEY=your-openai-api-key-here

# Optional: Alternative Speech-to-Text Services
GOOGLE_SPEECH_API_KEY=your-google-speech-api-key-here
AZURE_SPEECH_API_KEY=your-azure-speech-api-key-here

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50000000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=5
RATE_LIMIT_WINDOW_MINUTES=1
```

### 3. Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
npm start
```

## API Documentation

### Authentication

All API endpoints (except `/api/auth/*`) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

### Speech-to-Text Transcription

#### Upload Audio for Transcription
```http
POST /api/transcription/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- audio: <audio file>
- model: "fal-whisper" | "google" | "azure" (optional, default: "fal-whisper")
- language: "en" (optional)
- timestamp: true | false (optional, default: true)
- speakerDiarization: true | false (optional, default: false)
```

**Response:**
```json
{
  "success": true,
  "transcription": {
    "text": "The customer's 2019 Honda Civic needs brake pad replacement...",
    "language": "en",
    "confidence": 0.95,
    "segments": [...],
    "duration": 120.5,
    "wordCount": 45
  },
  "metadata": {
    "fileName": "repair_recording.mp3",
    "fileSize": 1024000,
    "mimeType": "audio/mpeg",
    "model": "fal-whisper",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Get Transcription History
```http
GET /api/transcription/history
Authorization: Bearer <token>
```

### Data Extraction

#### Extract Structured Data
```http
POST /api/extraction/extract
Authorization: Bearer <token>
Content-Type: application/json

{
  "transcription": "The customer's 2019 Honda Civic needs brake pad replacement. We found the front brake pads are worn down to 2mm...",
  "extractionType": "repair_details",
  "customSchema": {
    "fields": ["custom_field1", "custom_field2"],
    "description": "Extract custom data fields"
  }
}
```

**Response:**
```json
{
  "success": true,
  "extractedData": {
    "vehicle_info": "2019 Honda Civic",
    "problem_description": "Brake pad replacement needed",
    "diagnosis": "Front brake pads worn to 2mm",
    "repairs_performed": "Brake pad replacement",
    "parts_used": ["Front brake pads"],
    "labor_time": "1.5 hours",
    "confidence": 0.92
  },
  "metadata": {
    "extractionType": "repair_details",
    "transcriptionLength": 150,
    "timestamp": "2024-01-15T10:45:00Z",
    "userId": "user_123"
  }
}
```

#### Batch Data Extraction
```http
POST /api/extraction/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "transcriptions": [
    {
      "id": "transcript_1",
      "text": "Customer complaint about brake noise..."
    },
    {
      "id": "transcript_2", 
      "text": "Oil change service for 2020 Toyota Camry..."
    }
  ],
  "extractionType": "repair_details"
}
```

#### Get Available Extraction Schemas
```http
GET /api/extraction/schemas
Authorization: Bearer <token>
```

## Extraction Types

### 1. Repair Details (`repair_details`)
Extracts comprehensive repair information:
- Vehicle information
- Problem description
- Diagnosis findings
- Repairs performed
- Parts used
- Labor time
- Recommendations

### 2. Parts Inventory (`parts_inventory`)
Extracts parts and inventory data:
- Part numbers
- Part descriptions
- Quantities
- Suppliers
- Costs
- Installation notes

### 3. Labor Hours (`labor_hours`)
Extracts time and labor information:
- Tasks performed
- Time per task
- Total hours
- Technician notes
- Difficulty level

### 4. Customer Info (`customer_info`)
Extracts customer and vehicle details:
- Customer name
- Contact information
- Vehicle details (year, make, model)
- VIN number
- Mileage
- Service requests

### 5. Custom Schema (`custom`)
Define your own extraction fields with a custom schema.

## Supported Audio Formats

- MP3 (.mp3)
- WAV (.wav)
- M4A (.m4a)
- MP4 (.mp4)
- WebM (.webm)
- FLAC (.flac)

**File Size Limit**: 50MB (configurable via `MAX_FILE_SIZE` environment variable)

## Rate Limiting

- **Default**: 5 requests per minute per IP address
- **Configurable**: Adjust via `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MINUTES`
- **Response**: Returns 429 status code when limit exceeded

## Error Handling

The API returns standardized error responses:

```json
{
  "error": "Error description",
  "details": [...] // Additional error details when available
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── index.ts              # Application entry point
├── middleware/           # Express middleware
│   ├── auth.ts          # JWT authentication
│   └── errorHandler.ts  # Error handling
├── routes/              # API route handlers
│   ├── auth.ts          # Authentication routes
│   ├── transcription.ts # Speech-to-text routes
│   └── extraction.ts    # Data extraction routes
└── services/            # Business logic services
    ├── speechToText.ts  # Speech-to-text service
    └── dataExtraction.ts # Data extraction service
```

## Security Features

- ✅ JWT-based authentication with secure token generation
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Rate limiting (5 requests/minute by default)
- ✅ Input validation with Zod schemas
- ✅ Helmet for security headers
- ✅ CORS protection
- ✅ File type validation for uploads
- ✅ Environment variable configuration for secrets

## Future Enhancements

- [ ] Database integration for persistent storage
- [ ] WebSocket support for real-time transcription
- [ ] Google Speech-to-Text integration
- [ ] Azure Speech Services integration
- [ ] Advanced speaker diarization
- [ ] Audio preprocessing and noise reduction
- [ ] Dashboard UI for transcription management
- [ ] Webhook support for external integrations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please open an issue in the GitHub repository or contact the development team. 